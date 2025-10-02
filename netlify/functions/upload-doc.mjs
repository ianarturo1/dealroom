import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/

function sanitizeSegment(value, label, { lowercase = false } = {}){
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw){
    throw text(400, `${label} requerido`)
  }
  if (!SAFE_SEGMENT.test(raw)){
    throw text(400, `${label} inválido`)
  }
  return lowercase ? raw.toLowerCase() : raw
}

const formatTimestamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}${m}${d}-${h}${min}${s}`
}

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

async function ensureUniquePath(repo, pathBuilder, branch){
  let attempt = 0
  while (attempt < 10){
    const { path, filename } = pathBuilder(attempt)
    try{
      await getFile(repo, path, branch)
      attempt += 1
    }catch(error){
      if (isGitHubNotFound(error)){
        return { path, filename }
      }
      throw error
    }
  }
  throw text(409, 'No se pudo generar un nombre único para el archivo')
}

export async function handler(event){
  try{
    if (event.httpMethod && event.httpMethod !== 'POST'){
      return text(405, 'Method not allowed')
    }

    const repo = repoEnv('DOCS_REPO', '').trim()
    const branch = (process.env.DOCS_BRANCH || 'main').trim()
    const token = process.env.GITHUB_TOKEN

    if (!repo || !branch || !token){
      return text(500, 'DOCS_REPO/DOCS_BRANCH/GITHUB_TOKEN no configurados')
    }

    let body
    try{
      body = JSON.parse(event.body || '{}')
    }catch(_err){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(body.path || body.category, 'category')
    const investor = sanitizeSegment(body.investor ?? body.slug, 'investor', { lowercase: true })
    const filename = sanitizeSegment(body.filename, 'filename')
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : ''
    const strategy = body.strategy === 'rename' ? 'rename' : 'default'

    if (!contentBase64){
      return text(400, 'contentBase64 requerido')
    }

    const basePath = `${category}/${investor}`
    const originalPath = `${basePath}/${filename}`

    let existing = null
    try{
      existing = await getFile(repo, originalPath, branch)
    }catch(error){
      if (!isGitHubNotFound(error)){
        throw error
      }
    }

    if (existing && strategy !== 'rename'){
      return json(409, {
        error: 'FILE_EXISTS',
        message: 'File already exists in that category',
        path: originalPath
      })
    }

    let finalPath = originalPath
    let finalFilename = filename
    let renamed = false

    if (existing && strategy === 'rename'){
      const dotIndex = filename.lastIndexOf('.')
      const base = dotIndex > -1 ? filename.slice(0, dotIndex) : filename
      const ext = dotIndex > -1 ? filename.slice(dotIndex) : ''

      const result = await ensureUniquePath(
        repo,
        (attempt) => {
          const suffixBase = formatTimestamp()
          const suffix = attempt > 0 ? `${suffixBase}-${attempt}` : suffixBase
          const candidate = `${base}_${suffix}${ext}`
          return {
            filename: candidate,
            path: `${basePath}/${candidate}`
          }
        },
        branch
      )

      finalPath = result.path
      finalFilename = result.filename
      renamed = true
    }

    await putFile(
      repo,
      finalPath,
      contentBase64,
      `docs: upload ${category}/${investor}/${finalFilename}`,
      undefined,
      branch
    )

    return json(200, {
      ok: true,
      path: finalPath,
      filename: finalFilename,
      renamed
    })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error && (error.statusCode || error.status) ? (error.statusCode || error.status) : 500
    const message = error && error.message ? error.message : 'Error inesperado'
    if (status === 409){
      return json(409, { error: 'FILE_EXISTS', message, path: '' })
    }
    return text(status, message)
  }
}
