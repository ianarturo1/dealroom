import { text } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

const SAFE_SEGMENT = /^[a-zA-Z0-9._ -]+$/

const normalizeForTest = (value) => value
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')

const sanitizeSegment = (value, label, { lower = false } = {}) => {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) throw text(400, `${label} requerido`)
  if (!SAFE_SEGMENT.test(normalizeForTest(raw))){
    throw text(400, `${label} inválido`)
  }
  return lower ? raw.toLowerCase() : raw
}

export async function handler(event){
  try{
    if (event.httpMethod && event.httpMethod !== 'GET'){
      return text(405, 'Method not allowed')
    }

    const repo = repoEnv('DOCS_REPO', '').trim()
    const branch = (process.env.DOCS_BRANCH || 'main').trim()
    if (!repo || !branch || !process.env.GITHUB_TOKEN){
      return text(500, 'DOCS_REPO/DOCS_BRANCH/GITHUB_TOKEN no configurados')
    }

    const params = event.queryStringParameters || {}
    const relPathRaw = typeof params.path === 'string' ? params.path.trim() : ''
    if (!relPathRaw) return text(400, 'Falta path')

    const investorParam = sanitizeSegment(params.investor ?? params.slug, 'investor', { lower: true })

    const normalizedPath = relPathRaw.replace(/^\/+/, '')
    if (normalizedPath.includes('..')) return text(400, 'Ruta inválida')

    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length !== 3) return text(400, 'Ruta inválida')

    const category = sanitizeSegment(segments[0], 'category')
    const investorSegment = sanitizeSegment(segments[1], 'investor', { lower: true })
    const filename = sanitizeSegment(segments[2], 'filename')

    if (investorSegment !== investorParam){
      return text(404, 'Documento no encontrado o acceso denegado.')
    }

    const repoPath = `${category}/${investorSegment}/${filename}`
    const file = await getFile(repo, repoPath, branch)
    const encoding = typeof file.encoding === 'string' ? file.encoding.toLowerCase() : 'base64'
    const buff = encoding === 'base64'
      ? Buffer.from(file.content || '', 'base64')
      : Buffer.from(file.content || '', 'utf-8')

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename=${filename}`
      },
      body: buff.toString('base64'),
      isBase64Encoded: true
    }
  }catch(err){
    const message = typeof err?.message === 'string' ? err.message : 'Error inesperado'
    if (message.includes('404')){
      return text(404, 'Documento no encontrado o acceso denegado.')
    }
    const status = err?.statusCode || err?.status || 500
    return text(status, message)
  }
}
