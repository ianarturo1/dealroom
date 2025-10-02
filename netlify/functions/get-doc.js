import { text } from './_lib/utils.mjs'
import { repoEnv, getFile, contentTypeFor } from './_lib/github.mjs'

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
    const relPathRaw = typeof params.path === 'string' ? params.path : ''
    if (!relPathRaw){
      return text(400, 'Falta path')
    }

    const normalizedPath = relPathRaw.replace(/^\/+/, '')
    if (normalizedPath.includes('..')){
      return text(400, 'Ruta inválida')
    }

    const segments = normalizedPath.split('/').filter(Boolean)
    if (segments.length < 3){
      return text(400, 'Ruta inválida')
    }

    const [rawCategory, rawInvestor, ...rest] = segments
    const category = sanitizeSegment(rawCategory, 'category')
    const investorFromPath = sanitizeSegment(rawInvestor, 'investor', { lowercase: true })

    const investorParam = sanitizeSegment(
      params.investor ?? params.slug,
      'investor',
      { lowercase: true }
    )

    if (investorParam !== investorFromPath){
      return text(404, 'Documento no encontrado o acceso denegado.')
    }

    const finalSegments = rest.map((segment, index) => (
      sanitizeSegment(segment, `path segment ${index + 1}`)
    ))

    const repoPath = [category, investorFromPath, ...finalSegments].join('/')

    const file = await getFile(repo, repoPath, branch)
    const encoding = typeof file.encoding === 'string' ? file.encoding.toLowerCase() : 'base64'
    const buff = encoding === 'base64'
      ? Buffer.from(file.content || '', 'base64')
      : Buffer.from(file.content || '', 'utf-8')
    const filename = finalSegments[finalSegments.length - 1] || file.name

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentTypeFor(filename),
        'Content-Disposition': `attachment; filename="${filename}"`
      },
      body: buff.toString('base64'),
      isBase64Encoded: true
    }
  }catch(error){
    if (error && typeof error.statusCode === 'number' && error.body){
      return error
    }
    const message = String(error && error.message ? error.message : error)
    if (message.includes('404')){
      return text(404, 'Documento no encontrado o acceso denegado.')
    }
    const status = error && (error.statusCode || error.status) ? (error.statusCode || error.status) : 500
    return text(status, message)
  }
}
