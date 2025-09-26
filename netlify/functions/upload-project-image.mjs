import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const MAX_FILE_SIZE = 2 * 1024 * 1024
const ALLOWED_MIME_EXT = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/webp', 'webp']
])
const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

function headerValue(headers = {}, name){
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)){
    if (typeof value === 'string' && key.toLowerCase() === target) return value
  }
  return ''
}

function parseMultipartFile(event){
  const contentType = headerValue(event.headers, 'content-type')
  if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')){
    throw new Error('Content-Type inválido, se esperaba multipart/form-data')
  }
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i)
  if (!boundaryMatch){
    throw new Error('boundary no especificado')
  }
  const boundary = `--${boundaryMatch[1]}`
  const bodyBuffer = event.body
    ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
    : Buffer.alloc(0)
  const boundaryBuffer = Buffer.from(boundary)
  let cursor = 0

  while (cursor < bodyBuffer.length){
    const boundaryIndex = bodyBuffer.indexOf(boundaryBuffer, cursor)
    if (boundaryIndex === -1) break
    let partStart = boundaryIndex + boundaryBuffer.length
    if (partStart >= bodyBuffer.length) break
    // End marker "--"
    if (bodyBuffer[partStart] === 45 && bodyBuffer[partStart + 1] === 45) break
    if (bodyBuffer[partStart] === 13 && bodyBuffer[partStart + 1] === 10){
      partStart += 2
    }
    const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, partStart)
    if (nextBoundaryIndex === -1) break
    let partEnd = nextBoundaryIndex - 1
    while (partEnd >= partStart && (bodyBuffer[partEnd] === 10 || bodyBuffer[partEnd] === 13)){
      partEnd -= 1
    }
    if (partEnd < partStart){
      cursor = nextBoundaryIndex
      continue
    }
    const partBuffer = bodyBuffer.slice(partStart, partEnd + 1)
    const headerEndIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'))
    if (headerEndIndex === -1){
      cursor = nextBoundaryIndex
      continue
    }
    const headerText = partBuffer.slice(0, headerEndIndex).toString('utf8')
    const data = partBuffer.slice(headerEndIndex + 4)

    const headers = {}
    for (const line of headerText.split('\r\n')){
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim().toLowerCase()
      const value = line.slice(idx + 1).trim()
      headers[key] = value
    }

    const disposition = headers['content-disposition'] || ''
    const filenameMatch = disposition.match(/filename="([^\"]*)"/i)
    if (!filenameMatch) {
      cursor = nextBoundaryIndex
      continue
    }
    const nameMatch = disposition.match(/name="([^\"]*)"/i)
    const filename = filenameMatch[1]
    const contentTypePart = headers['content-type'] || ''
    return { fieldName: nameMatch ? nameMatch[1] : '', filename, contentType: contentTypePart, data }
  }

  return null
}

function buildRawGithubUrl(repo, branch, relPath){
  const [owner, name] = (repo || '').split('/')
  if (!owner || !name) throw new Error('DOCS_REPO inválido')
  const branchPath = branch.split('/').map(segment => encodeURIComponent(segment)).join('/')
  const encodedPath = relPath.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `https://raw.githubusercontent.com/${owner}/${name}/${branchPath}/${encodedPath}`
}

export async function handler(event){
  if (event.httpMethod !== 'POST'){
    return text(405, 'Método no permitido', { 'Allow': 'POST' })
  }

  const projectId = typeof event.queryStringParameters?.projectId === 'string'
    ? event.queryStringParameters.projectId.trim()
    : ''
  if (!projectId){
    return text(400, 'projectId requerido')
  }
  if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')){
    return text(400, 'projectId inválido')
  }

  let filePart
  try{
    filePart = parseMultipartFile(event)
  }catch(error){
    return text(400, error.message || 'No se pudo leer el archivo enviado')
  }

  if (!filePart || !filePart.data || !filePart.data.length){
    return text(400, 'No se recibió archivo')
  }

  const size = filePart.data.length
  if (size > MAX_FILE_SIZE){
    return text(400, 'La imagen supera el tamaño máximo de 2 MB')
  }

  const originalExt = (filePart.filename || '').split('.').pop()?.toLowerCase() || ''
  const mimeExt = ALLOWED_MIME_EXT.get((filePart.contentType || '').toLowerCase()) || ''
  let extension = originalExt || mimeExt
  if (extension === 'jpg' || extension === 'jpeg'){
    extension = extension === 'jpeg' && originalExt === 'jpeg' ? 'jpeg' : 'jpg'
  }
  if (!extension && mimeExt){
    extension = mimeExt
  }
  if (!ALLOWED_EXTENSIONS.has(extension)){
    return text(400, 'Tipo de imagen no permitido')
  }

  const repo = repoEnv('DOCS_REPO', '')
  const branch = process.env.DOCS_BRANCH || 'main'
  if (!repo || !process.env.GITHUB_TOKEN){
    return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')
  }

  const relPath = `assets/projects/${projectId}/cover.${extension}`

  let sha
  try{
    const existing = await getFile(repo, relPath, branch)
    sha = existing?.sha
  }catch(error){
    const msg = String(error?.message || '')
    if (!msg.includes('404')){
      throw error
    }
  }

  const contentBase64 = filePart.data.toString('base64')
  await putFile(repo, relPath, contentBase64, `Subir imagen de proyecto ${projectId}`, sha, branch)

  const imageUrl = buildRawGithubUrl(repo, branch, relPath)
  return ok({ imageUrl })
}
