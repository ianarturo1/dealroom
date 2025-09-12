import { ok, text, requireUser, emailDomain, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

export async function handler(event, context){
  try{
    const user = context.clientContext && context.clientContext.user
    // optional slug override for admins
    const slug = event.queryStringParameters && event.queryStringParameters.slug
    const domain = user ? emailDomain(user) : null

    const contentRepo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'

    // Resolve slug: explicit > by email domain mapping > fallback demo
    let resolved = slug
    if (!resolved){
      try {
        const idx = await readLocalJson('data/investor-index.json')
        resolved = idx.domains[domain] || 'femsa'
      } catch(_) {
        resolved = 'femsa'
      }
    }

    async function loadLocal(){
      return await readLocalJson(`data/investors/${resolved}.json`)
    }

    if (!contentRepo || !process.env.GITHUB_TOKEN){
      const data = await loadLocal()
      return ok(data)
    }

    // From GitHub (same repo), path: data/investors/<slug>.json
    const file = await getFile(contentRepo, `data/investors/${resolved}.json`, branch)
    const buff = Buffer.from(file.content, file.encoding || 'base64')
    const json = JSON.parse(buff.toString('utf-8'))
    return ok(json)
  }catch(err){
    return text(500, err.message)
  }
}
