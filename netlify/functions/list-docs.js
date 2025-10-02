import { ok, text } from './_lib/utils.mjs'
import { repoEnv, listDir } from './_lib/github.mjs'

function sanitizeSegment(value){
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._() \-]/gu, '')
    .trim()
}

function normalizeLower(value){
  return sanitizeSegment(value).toLowerCase()
}

function defaultSlug(){
  const envSlug = normalizeLower(process.env.PUBLIC_INVESTOR_SLUG || '')
  return envSlug || 'femsa'
}

export async function handler(event){
  try{
    const categoryParam = event.queryStringParameters && event.queryStringParameters.category
    const slugParam = event.queryStringParameters && event.queryStringParameters.slug
    const safeCategory = sanitizeSegment(categoryParam) || 'NDA'
    const requestedSlug = typeof slugParam === 'string' ? sanitizeSegment(slugParam).toLowerCase() : ''
    const envSlugRaw = sanitizeSegment(process.env.PUBLIC_INVESTOR_SLUG || '')
    const envSlug = envSlugRaw ? envSlugRaw.toLowerCase() : ''

    let slug = requestedSlug || defaultSlug()
    if (envSlug){
      const normalizedEnv = envSlug.toLowerCase()
      if (requestedSlug && requestedSlug !== normalizedEnv){
        return text(403, 'Slug not allowed')
      }
      slug = envSlug
    }

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'

    if (!repo || !process.env.GITHUB_TOKEN){
      return ok({ files: [] })
    }

    const basePath = `${safeCategory}/${slug}`
    let list = []
    try{
      const items = await listDir(repo, basePath, branch)
      list = items.filter(x => x.type === 'file').map(x => ({
        name: x.name,
        filename: x.name,
        path: `${basePath}/${x.name}`,
        size: typeof x.size === 'number' ? x.size : 0,
        sizeBytes: typeof x.size === 'number' ? x.size : 0,
        sizeKB: typeof x.size === 'number' ? Math.max(0, Math.round(x.size / 1024)) : 0
      }))
    }catch(_){
      list = []
    }
    return ok({ files: list })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
