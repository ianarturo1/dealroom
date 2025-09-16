import { text } from './_lib/utils.mjs'
import { repoEnv, getFile, contentTypeFor } from './_lib/github.mjs'

function publicSlug(){
  const raw = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
    ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
    : ''
  return raw || 'femsa'
}

export async function handler(event){
  try{
    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    const relPathRaw = (event.queryStringParameters && event.queryStringParameters.path) || ''
    if (!relPathRaw) return text(400, 'Falta path')

    const normalized = relPathRaw.replace(/^\/+/, '')
    const parts = normalized.split('/')
    if (parts.length < 3) return text(400, 'Ruta inválida')
    const [, slug] = parts
    if (slug !== publicSlug()) return text(403, 'Acceso solo para contenido público')

    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    const file = await getFile(repo, normalized, branch)
    const buff = Buffer.from(file.content, file.encoding || 'base64')
    return {
      statusCode: 200,
      headers: {
        'content-type': contentTypeFor(file.name),
        'content-disposition': `attachment; filename="${file.name}"`
      },
      body: buff.toString('base64'),
      isBase64Encoded: true
    }
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
