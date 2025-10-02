import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/

const normalizeForTest = (value) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')

function sanitizeSegment(value, label, { lower = false } = {}) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw text(400, `${label} requerido`)
  const comparable = normalizeForTest(raw)
  if (!SAFE_SEGMENT.test(comparable)) {
    throw text(400, `${label} inválido`)
  }
  return lower ? raw.toLowerCase() : raw
}

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

const timestampSuffix = () => {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const date = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join('')
  const time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('')
  return `${date}-${time}`
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
    }catch(_){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(body.path ?? body.category, 'category')
    const investor = sanitizeSegment(body.investor ?? body.slug, 'investor', { lower: true })
    const filename = sanitizeSegment(body.filename, 'filename')
    const contentBase64 = typeof body.contentBase64 === 'string' ? body.contentBase64.trim() : ''
    if (!contentBase64){
      return text(400, 'contentBase64 requerido')
    }

    const strategy = typeof body.strategy === 'string' ? body.strategy : undefined

    const basePath = `${category}/${investor}`
    const originalPath = `${basePath}/${filename}`

    let existing = null
    try{
      existing = await getFile(repo, originalPath, branch)
    }catch(error){
      if (!isGitHubNotFound(error)) throw error
    }

    if (existing && strategy !== 'rename'){
      return json(409, {
        error: 'FILE_EXISTS',
        message: 'File already exists in that category',
        path: originalPath
      })
    }

    let finalFilename = filename
    let finalPath = originalPath

    if (existing && strategy === 'rename'){
      const dotIndex = filename.lastIndexOf('.')
      const baseName = dotIndex >= 0 ? filename.slice(0, dotIndex) : filename
      const extension = dotIndex >= 0 ? filename.slice(dotIndex) : ''
      finalFilename = `${baseName}_${timestampSuffix()}${extension}`
      finalPath = `${basePath}/${finalFilename}`

      try{
        const renamedExisting = await getFile(repo, finalPath, branch)
        if (renamedExisting){
          return json(409, {
            error: 'FILE_EXISTS',
            message: 'File already exists in that category',
            path: finalPath
          })
        }
      }catch(error){
        if (!isGitHubNotFound(error)) throw error
      }
    }

    const commitMessage = `docs: upload ${category}/${investor}/${finalFilename}`

    await putFile(
      repo,
      finalPath,
      contentBase64,
      commitMessage,
      existing && !strategy ? existing.sha : undefined,
      branch
    )

    return json(200, {
      ok: true,
      path: finalPath,
      renamed: Boolean(existing && strategy === 'rename'),
      fileName: finalFilename
    })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error?.statusCode || error?.status || 500
    const message = error && error.message ? error.message : 'Error interno'
    return text(status, message)
  }
}
