import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, deleteFile } from './_lib/github.mjs'

function cleanPath(input = ''){
  return String(input).replace(/^\/+|\/+$/g, '')
}

export default async function handler(event, context){
  try{
    const body = JSON.parse(event.body || '{}')
    const relPath = cleanPath(body.path || '')
    if (!relPath) return text(400, 'Missing path')
    if (relPath.includes('..')) return text(400, 'Ruta inválida')
    if (!relPath.startsWith('data/docs/alsea/')) return text(403, 'Slug not allowed')

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    let file
    try{
      file = await getFile(repo, relPath, branch)
    }catch(error){
      if (error.message && error.message.includes('GitHub 404')){
        return text(404, 'Archivo no encontrado')
      }
      throw error
    }
    await deleteFile(repo, relPath, body.message || `Delete ${relPath}`, file.sha, branch)
    return ok({ ok: true })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
