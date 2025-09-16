import { ok, text, requireUser, hasAnyRole, emailDomain, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

export async function handler(event, context){
  try{
    const user = requireUser(event, context)
    const body = JSON.parse(event.body || '{}')
    const categoryPath = (body.path || '').replace(/^\/+|\/+$/g,'') // sanitize
    const filename = body.filename
    const contentBase64 = body.contentBase64
    if (!categoryPath || !filename || !contentBase64) return text(400, 'Faltan datos (path, filename, contentBase64)')

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    // access rule
    let allowedPathPrefix = ''
    if (hasAnyRole(user, ['admin','ri'])){
      // can upload anywhere, but must include investor slug folder under category
      allowedPathPrefix = categoryPath
    } else {
      const idx = await readLocalJson('data/investor-index.json')
      const slug = idx.domains[emailDomain(user)]
      if (!slug) return text(403, 'No mapeado a un inversionista')
      allowedPathPrefix = `${categoryPath}/${slug}`
    }

    const relPath = `${allowedPathPrefix}/${filename}`
    let sha = undefined
    try {
      const f = await getFile(repo, relPath, branch)
      sha = f.sha
    }catch(_){ /* new file */ }

    const res = await putFile(repo, relPath, contentBase64, body.message || `Upload ${filename}`, sha, branch)
    return ok({ ok:true, path: relPath })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
