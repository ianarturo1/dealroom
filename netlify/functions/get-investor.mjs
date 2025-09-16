import { ok, text, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

function publicSlug(){
  const raw = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
    ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
    : ''
  return raw || 'femsa'
}

async function loadLocal(slug){
  return readLocalJson(`data/investors/${slug}.json`)
}

export async function handler(event){
  try{
    const slugParam = event && event.queryStringParameters && event.queryStringParameters.slug
    const requested = typeof slugParam === 'string' ? slugParam.trim().toLowerCase() : ''
    const fallbackSlug = publicSlug()
    const slug = requested || fallbackSlug

    const contentRepo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'

    async function load(slugToLoad){
      try {
        if (!contentRepo || !process.env.GITHUB_TOKEN){
          return await loadLocal(slugToLoad)
        }
        const file = await getFile(contentRepo, `data/investors/${slugToLoad}.json`, branch)
        const buff = Buffer.from(file.content, file.encoding || 'base64')
        return JSON.parse(buff.toString('utf-8'))
      } catch (err) {
        if (slugToLoad !== fallbackSlug){
          return load(fallbackSlug)
        }
        throw err
      }
    }

    const data = await load(slug)
    return ok(data)
  }catch(err){
    return text(500, err.message)
  }
}
