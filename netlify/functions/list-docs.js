import { ok, text } from './_lib/utils.mjs'
import { repoEnv, listDir } from './_lib/github.mjs'

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
    if (event.httpMethod && event.httpMethod !== 'GET'){
      return text(405, 'Method not allowed')
    }

    const repo = repoEnv('DOCS_REPO', '').trim()
    const branch = (process.env.DOCS_BRANCH || 'main').trim()
    const token = process.env.GITHUB_TOKEN

    if (!repo || !branch || !token){
      return text(500, 'DOCS_REPO/DOCS_BRANCH/GITHUB_TOKEN no configurados')
    }

    const params = event.queryStringParameters || {}
    const category = sanitizeSegment(params.category || 'NDA', 'category')
    const investor = sanitizeSegment(
      params.investor ?? params.slug,
      'investor',
      { lowercase: true }
    )

    const basePath = `${category}/${investor}`

    let items
    try{
      items = await listDir(repo, basePath, branch)
    }catch(error){
      const message = String(error && error.message ? error.message : error)
      if (message.includes('GitHub 404')){
        return ok({ files: [] })
      }
      throw error
    }

    const files = Array.isArray(items)
      ? items
          .filter((item) => item && item.type === 'file')
          .map((item) => ({
            name: item.name,
            path: `${basePath}/${item.name}`,
            size: typeof item.size === 'number' ? item.size : 0
          }))
      : []

    return ok({ files })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error && (error.statusCode || error.status) ? (error.statusCode || error.status) : 500
    const message = error && error.message ? error.message : 'Error inesperado'
    return text(status, message)
  }
}
