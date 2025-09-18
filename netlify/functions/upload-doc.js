import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

function publicSlug(){
  const raw = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
    ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
    : ''
  return raw || 'femsa'
}

export async function handler(event){
  try{
    const body = JSON.parse(event.body || '{}')
    const categoryPath = (body.path || '').replace(/^\/+|\/+$/g,'')
    const filename = body.filename
    const contentBase64 = body.contentBase64
    const slugInput = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    const slug = slugInput || publicSlug()
    if (!categoryPath || !filename || !contentBase64) return text(400, 'Faltan datos (path, filename, contentBase64)')

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    const relPath = `${categoryPath}/${slug}/${filename}`
    let sha = undefined
    try {
      const f = await getFile(repo, relPath, branch)
      sha = f.sha
    }catch(_){ /* new file */ }

    await putFile(repo, relPath, contentBase64, body.message || `Upload ${filename}`, sha, branch)
    return ok({ ok:true, path: relPath })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
