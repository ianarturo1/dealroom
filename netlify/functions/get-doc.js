import { text } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

function normalizeSlug(value){
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function publicSlug(){
  const raw = normalizeSlug(process.env.PUBLIC_INVESTOR_SLUG)
  return raw || 'femsa'
}

function allowedSlugFrom(event){
  const qp = event?.queryStringParameters || {}
  const requested = normalizeSlug(qp.investor)
  return requested || publicSlug()
}

export async function handler(event){
  try{
    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    const params = event.queryStringParameters || {}
    const relPathRaw = params.path || ''
    if (!relPathRaw) return text(400, 'Falta path')

    const normalizedPath = relPathRaw.replace(/^\/+/, '')
    if (normalizedPath.includes('..')) return text(400, 'Ruta inválida')

    const pathParts = normalizedPath.split('/').filter(Boolean)
    if (pathParts.length < 3) return text(400, 'Ruta inválida')

    const [category, slugPart, ...restParts] = pathParts
    const allowedSlug = allowedSlugFrom(event)
    if (!category || !slugPart || restParts.length === 0) return text(400, 'Ruta inválida')

    if (normalizeSlug(slugPart) !== allowedSlug){
      return text(404, 'Documento no encontrado o acceso denegado.')
    }

    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    const repoPath = [category, allowedSlug, ...restParts].join('/')
    const file = await getFile(repo, repoPath, branch)
    const encoding = typeof file.encoding === 'string' ? file.encoding.toLowerCase() : 'base64'
    const buff = encoding === 'base64'
      ? Buffer.from(file.content || '', 'base64')
      : Buffer.from(file.content || '', 'utf-8')
    const filename = restParts[restParts.length - 1] || file.name

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
