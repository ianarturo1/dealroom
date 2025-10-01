import { ok, text } from './_lib/utils.mjs'
import { repoEnv, listDir } from './_lib/github.mjs'

function publicInvestorId(){
  const raw = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
    ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
    : ''
  return raw || 'femsa'
}

export async function handler(event){
  try{
    const category = (event.queryStringParameters && event.queryStringParameters.category) || 'NDA'
    const investorParam = event.queryStringParameters
      && (event.queryStringParameters.investor ?? event.queryStringParameters.slug)
    const requested = typeof investorParam === 'string' ? investorParam.trim().toLowerCase() : ''
    const investorId = requested || publicInvestorId()

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'

    if (!repo || !process.env.GITHUB_TOKEN){
      return ok({ files: [] })
    }

    const basePath = `${category}/${investorId}`
    let list = []
    try{
      const items = await listDir(repo, basePath, branch)
      list = items.filter(x => x.type === 'file').map(x => ({
        name: x.name,
        path: `${basePath}/${x.name}`,
        size: x.size || 0
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
