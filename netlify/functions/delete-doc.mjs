import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

const GH_API = 'https://api.github.com'
const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/
const CATEGORY_WHITELIST = new Set([
  'NDA',
  'Propuestas',
  'Modelos financieros',
  'Contratos',
  'LOIs',
  'Sustento fiscal',
  'Mitigación de riesgos',
  'Procesos'
])

function sanitizeSegment(value, label){
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) throw text(400, `${label} requerido`)
  if (!SAFE_SEGMENT.test(str)) throw text(400, `${label} inválido`)
  return str
}

async function github(path, { method = 'GET', body } = {}){
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'netlify-fns'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok){
    const txt = await res.text()
    throw text(res.status, `GitHub ${res.status}: ${txt}`)
  }
  return res.json()
}

function repoParts(repo){
  const [owner, name] = String(repo).split('/')
  return { owner, name }
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
    }catch(error){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(payload.category, 'category')
    const investor = sanitizeSegment(payload.investor, 'investor').toLowerCase()
    const filename = sanitizeSegment(payload.filename, 'filename')

    if (CATEGORY_WHITELIST.size && !CATEGORY_WHITELIST.has(category)){
      return text(400, 'Categoría no permitida')
    }

    const publicInvestor = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
      ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
      : ''

    if (publicInvestor && investor !== publicInvestor){
      return text(403, 'Investor inválido')
    }

    const relPath = `${category}/${investor}/${filename}`

    let file
    try{
      file = await getFile(repo, relPath, branch)
    }catch(error){
      const message = error && error.message ? error.message : String(error)
      if (message.includes('GitHub 404')){
        return text(404, 'Archivo no encontrado')
      }
      throw error
    }

    const { owner, name } = repoParts(repo)
    const encodedPath = encodeURIComponent(relPath)
    const commitMessage = `docs: delete ${category}/${investor}/${filename}`

    await github(`/repos/${owner}/${name}/contents/${encodedPath}`, {
      method: 'DELETE',
      body: {
        message: commitMessage,
        sha: file.sha,
        branch,
        committer: {
          name: 'Dealroom Bot',
          email: 'bot@finsolar.local'
        }
      }
    })

    return json(200, { ok: true })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error && error.statusCode ? error.statusCode : 500
    const message = error && error.message ? error.message : 'Error interno'
    return text(status, message)
  }
}
