import { ok, text } from './_lib/utils.mjs'
import { repoEnv, listDir } from './_lib/github.mjs'

const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/

function sanitizeSegment(value, label, { lower = false } = {}){
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw text(400, `${label} requerido`)
  const comparable = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  if (!SAFE_SEGMENT.test(comparable)){
    throw text(400, `${label} inválido`)
  }
  return lower ? raw.toLowerCase() : raw
}

export async function handler(event){
  try{
    const params = event.queryStringParameters || {}
    const category = sanitizeSegment(params.category || 'NDA', 'category')
    const investor = sanitizeSegment(params.investor ?? params.slug, 'investor', { lower: true })

    const repo = repoEnv('DOCS_REPO', '').trim()
    const branch = (process.env.DOCS_BRANCH || 'main').trim()
    if (!repo || !branch || !process.env.GITHUB_TOKEN){
      return text(500, 'DOCS_REPO/DOCS_BRANCH/GITHUB_TOKEN no configurados')
    }

    const basePath = `${category}/${investor}`
    let entries = []
    try{
      const res = await listDir(repo, basePath, branch)
      if (Array.isArray(res)){
        entries = res.filter(item => item && item.type === 'file')
      }else if (res && res.type === 'file'){
        entries = [res]
      }
    }catch(error){
      const message = error && error.message ? error.message : String(error)
      if (!message.includes('GitHub 404')){
        throw error
      }
      entries = []
    }

    const files = entries.map(entry => ({
      name: entry.name,
      path: `${basePath}/${entry.name}`,
      size: entry.size || 0
    }))

    return ok({ files })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error?.statusCode || error?.status || 500
    const message = error && error.message ? error.message : 'Error interno'
    return text(status, message)
  }
}
