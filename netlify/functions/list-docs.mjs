import { ok, text, requireUser, emailDomain, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, listDir } from './_lib/github.mjs'

export async function handler(event, context){
  try{
    const user = requireUser(event, context)
    const category = (event.queryStringParameters && event.queryStringParameters.category) || 'NDA'
    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'

    // Resolve investor slug by email domain
    let slug = 'demo'
    try {
      const idx = await readLocalJson('data/investor-index.json')
      const domain = emailDomain(user)
      slug = idx.domains[domain] || 'femsa'
    }catch(_){}

    if (!repo || !process.env.GITHUB_TOKEN){
      // fallback: empty
      return ok({ files: [] })
    }

    const basePath = `${category}/${slug}`
    let list = []
    try{
      const items = await listDir(repo, basePath, branch)
      list = items.filter(x => x.type === 'file').map(x => ({
        name: x.name, path: `${basePath}/${x.name}`, size: x.size || 0
      }))
    }catch(_){
      list = []
    }
    return ok({ files: list })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
