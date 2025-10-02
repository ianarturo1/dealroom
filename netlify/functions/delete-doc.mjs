import { ok, text } from './_lib/utils.mjs'
import { repoEnv } from './_lib/github.mjs'

const GH_API = 'https://api.github.com'
const SEGMENT_PATTERN = /^[a-zA-Z0-9._ -]+$/
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

function normalizeForTest(value = ''){
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function sanitizeSegment(raw, label){
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) throw Object.assign(new Error(`${label} requerido`), { statusCode: 400 })
  if (value.includes('..') || value.includes('/') || value.includes('\\')){
    throw Object.assign(new Error(`${label} inválido`), { statusCode: 400 })
  }
  const comparable = normalizeForTest(value)
  if (!SEGMENT_PATTERN.test(comparable)){
    throw Object.assign(new Error(`${label} inválido`), { statusCode: 400 })
  }
  return value
}

function encodePath(path){
  return path.split('/').map((part) => encodeURIComponent(part)).join('/')
}

function headersWithAuth(token){
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'netlify-fns',
    'Content-Type': 'application/json'
  }
}

export async function handler(event){
  try{
    if (event.httpMethod && event.httpMethod !== 'POST'){
      return text(405, 'Method Not Allowed')
    }

    let payload
    try{
      payload = JSON.parse(event.body || '{}')
    }catch(_){
      return text(400, 'JSON inválido')
    }

    const category = sanitizeSegment(payload.category, 'Categoría')
    const investor = sanitizeSegment(payload.investor, 'Inversor').toLowerCase()
    const filename = sanitizeSegment(payload.filename, 'Archivo')

    if (CATEGORY_WHITELIST.size && !CATEGORY_WHITELIST.has(category)){
      return text(400, 'Categoría no permitida')
    }

    const publicInvestor = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
      ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
      : ''
    if (publicInvestor && investor !== publicInvestor){
      return text(403, 'Inversor inválido')
    }

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    const token = process.env.GITHUB_TOKEN || ''

    if (!repo || !branch || !token){
      return text(500, 'DOCS_REPO, DOCS_BRANCH o GITHUB_TOKEN no configurados')
    }

    const relPath = `${category}/${investor}/${filename}`
    const encodedPath = encodePath(relPath)

    const getUrl = `${GH_API}/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    const headers = headersWithAuth(token)

    const getRes = await fetch(getUrl, { headers })
    if (getRes.status === 404){
      return text(404, 'Archivo no encontrado')
    }
    if (!getRes.ok){
      const errText = await getRes.text().catch(() => '')
      return text(getRes.status, errText || 'Error al obtener archivo')
    }
    const metadata = await getRes.json()
    const sha = metadata && metadata.sha
    if (!sha){
      return text(500, 'No se pudo obtener SHA del archivo')
    }

    const deleteUrl = `${GH_API}/repos/${repo}/contents/${encodedPath}`
    const message = `docs: delete ${relPath}`
    const deleteBody = {
      message,
      sha,
      branch,
      committer: {
        name: 'Dealroom Bot',
        email: 'bot@finsolar.local'
      }
    }

    const deleteRes = await fetch(deleteUrl, {
      method: 'DELETE',
      headers,
      body: JSON.stringify(deleteBody)
    })
    if (!deleteRes.ok){
      const errText = await deleteRes.text().catch(() => '')
      return text(deleteRes.status, errText || 'No se pudo eliminar el archivo')
    }

    return ok({ ok: true })
  }catch(err){
    const status = err.statusCode || 500
    const message = err.message || 'Error inesperado'
    return text(status, message)
  }
}
