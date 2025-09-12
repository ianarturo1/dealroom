import { text, requireUser, hasAnyRole, emailDomain, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile, contentTypeFor } from './_lib/github.mjs'

export async function handler(event, context){
  try{
    const user = requireUser(context)
    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    const relPath = (event.queryStringParameters && event.queryStringParameters.path) || ''
    if (!relPath) return text(400, 'Falta path')

    // check access: investors can only access their slug path, ri/admin any
    let allowed = hasAnyRole(user, ['admin','ri'])
    if (!allowed){
      const domain = emailDomain(user)
      try {
        const idx = await readLocalJson('data/investor-index.json')
        const slug = idx.domains[domain]
        if (slug && relPath.includes(`/${slug}/`)) allowed = true
      }catch(_){}
    }
    if (!allowed) return text(403, 'Sin acceso al recurso solicitado')

    if (!repo || !process.env.GITHUB_TOKEN) return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')

    const file = await getFile(repo, relPath, branch)
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
    return text(500, err.message)
  }
}
