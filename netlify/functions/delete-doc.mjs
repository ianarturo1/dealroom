import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/
const GH_API = 'https://api.github.com'

function sanitizeSegment(value, label, { lower = false } = {}) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw text(400, `${label} requerido`)
  const comparable = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
  if (!SAFE_SEGMENT.test(comparable)) {
    throw text(400, `${label} inválido`)
  }
  return lower ? raw.toLowerCase() : raw
}

function repoParts(repo) {
  const [owner, name] = String(repo).split('/')
  return { owner, name }
}

async function github(path, init) {
  const token = process.env.GITHUB_TOKEN
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'netlify-fns',
      'Content-Type': 'application/json',
      ...init?.headers
    }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw text(res.status, `GitHub ${res.status}: ${body}`)
  }
  return res.json()
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
    }catch(_){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(payload.category, 'category')
    const investor = sanitizeSegment(payload.investor, 'investor', { lower: true })
    const filename = sanitizeSegment(payload.filename, 'filename')

    const fullPath = `${category}/${investor}/${filename}`

    let file
    try{
      file = await getFile(repo, fullPath, branch)
    }catch(error){
      const message = error && error.message ? error.message : String(error)
      if (message.includes('GitHub 404')){
        return text(404, 'Archivo no encontrado')
      }
      throw error
    }

    const { owner, name } = repoParts(repo)
    const encodedPath = encodeURIComponent(fullPath)
    const commitMessage = `docs: delete ${fullPath}`

    await github(`/repos/${owner}/${name}/contents/${encodedPath}`, {
      method: 'DELETE',
      body: JSON.stringify({
        message: commitMessage,
        sha: file.sha,
        branch,
        committer: {
          name: 'Dealroom Bot',
          email: 'bot@dealroom.local'
        }
      })
    })

    return json(200, { ok: true })
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const status = error?.statusCode || error?.status || 500
    const message = error && error.message ? error.message : 'Error interno'
    return text(status, message)
  }
}
