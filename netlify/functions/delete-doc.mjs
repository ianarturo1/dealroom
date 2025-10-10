import { repoEnv, getFile, deleteFile } from './_lib/github.mjs'
import { json, badRequest, errorJson, notFound } from './_shared/http.mjs'
import { ensureSlugAllowed } from './_shared/slug.mjs'

function cleanPath(input = ''){
  return String(input).replace(/^\/+|\/+$/g, '')
}

export default async function handler(request, context){
  try{
    let body = {}
    try{
      body = await request.json()
    }catch(_){
      body = {}
    }
    const relPath = cleanPath(body.path || '')
    if (!relPath) return badRequest('Missing path')
    if (relPath.includes('..')) return badRequest('Ruta inválida')

    const slugMatch = relPath.match(/^data\/docs\/([^/]+)\//)
    if (!slugMatch) return errorJson('Slug not allowed', 403)
    const slug = slugMatch[1]

    // --- Allow admin context (no slug or wildcard config) ---
    const rawSingle = String(process.env.PUBLIC_INVESTOR_SLUG || '').trim().toLowerCase()
    const rawList   = String(process.env.PUBLIC_INVESTOR_SLUGS || '').trim().toLowerCase()
    const noRestrictions = (!rawSingle && !rawList) || rawSingle === '*' || rawList === '*'

    if (noRestrictions) {
      console.warn('[delete-doc] Bypassing slug check for admin/global context')
    } else {
      ensureSlugAllowed(slug)
    }

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN) return errorJson('DOCS_REPO/GITHUB_TOKEN no configurados')

    let file
    try{
      file = await getFile(repo, relPath, branch)
    }catch(error){
      if (error.message && error.message.includes('GitHub 404')){
        return notFound('Archivo no encontrado')
      }
      throw error
    }
    await deleteFile(repo, relPath, body.message || `Delete ${relPath}`, file.sha, branch)
    return json({ ok: true })
  }catch(err){
    const status = err.statusCode || 500
    return errorJson(err.message || 'Internal error', status)
  }
}
