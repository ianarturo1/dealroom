import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile, deleteFile } from './_lib/github.mjs'

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

    let payload
    try{
      payload = JSON.parse(event.body || '{}')
    }catch(_err){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(payload.category, 'category')
    const investor = sanitizeSegment(payload.investor, 'investor', { lowercase: true })
    const filename = sanitizeSegment(payload.filename, 'filename')

    const relPath = `${category}/${investor}/${filename}`

    let file
    try{
      file = await getFile(repo, relPath, branch)
    }catch(error){
      const message = String(error && error.message ? error.message : error)
      if (message.includes('GitHub 404')){
        return text(404, 'Archivo no encontrado')
      }
      throw error
    }

    await deleteFile(
      repo,
      relPath,
      `docs: delete ${category}/${investor}/${filename}`,
      file?.sha,
      branch
    )

    return json(200, { ok: true })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error && (error.statusCode || error.status) ? (error.statusCode || error.status) : 500
    const message = error && error.message ? error.message : 'Error interno'
    return text(status, message)
  }
}
