import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

const GH_API = 'https://api.github.com'
const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/

function sanitizeSegment(value, label) {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) throw text(400, `${label} requerido`)
  if (!SAFE_SEGMENT.test(str)) throw text(400, `${label} inválido`)
  return str
}

async function github(path, { method = 'GET', body } = {}) {
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
  if (!res.ok) {
    const txt = await res.text()
    throw text(res.status, `GitHub ${res.status}: ${txt}`)
  }
  return res.json()
}

function repoParts(repo) {
  const [owner, name] = String(repo).split('/')
  return { owner, name }
}

export async function handler(req) {
  if (req.method !== 'POST') {
    return text(405, 'Method not allowed')
  }

  const repo = repoEnv('DOCS_REPO', '').trim()
  const branch = (process.env.DOCS_BRANCH || 'main').trim()
  const token = process.env.GITHUB_TOKEN

  if (!repo || !branch || !token) {
    return text(500, 'DOCS_REPO/DOCS_BRANCH/GITHUB_TOKEN no configurados')
  }

  let payload = {}
  try {
    const raw = await req.text()
    payload = JSON.parse(raw || '{}')
  } catch (error) {
    return text(400, 'JSON inválido')
  }

  const category = sanitizeSegment(payload.category, 'category')
  const investor = sanitizeSegment(payload.investor, 'investor').toLowerCase()
  const filename = sanitizeSegment(payload.filename, 'filename')

  const fullPath = `${category}/${investor}/${filename}`
  const { owner, name } = repoParts(repo)

  // Paso 1: obtener el SHA actual del archivo
  const meta = await github(`/repos/${owner}/${name}/contents/${encodeURIComponent(fullPath)}?ref=${branch}`)

  const sha = meta.sha
  if (!sha) return text(404, 'SHA no encontrado para el archivo')

  // Paso 2: eliminar el archivo usando GitHub API
  const result = await github(`/repos/${owner}/${name}/contents/${encodeURIComponent(fullPath)}`, {
    method: 'PUT',
    body: {
      message: `docs: delete ${fullPath}`,
      sha,
      branch,
      committer: {
        name: 'Dealroom Bot',
        email: 'bot@finsolar.local'
      }
    }
  })

  return json({
    ok: true,
    path: fullPath,
    commit: result.commit?.sha
  })
}
