import { Buffer } from 'node:buffer'
import { ok, text, readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'

const normalizeSlug = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

const defaultSlug = () => {
  const envValue = normalizeSlug(process.env.PUBLIC_INVESTOR_SLUG)
  return envValue || 'femsa'
}

async function loadInvestorFromRepo(repo, slug, branch){
  const path = `data/investors/${slug}.json`
  const file = await getFile(repo, path, branch)
  const buff = Buffer.from(file.content, file.encoding || 'base64')
  return JSON.parse(buff.toString('utf-8'))
}

async function loadInvestor(slug){
  const repo = repoEnv('CONTENT_REPO', '')
  const branch = process.env.CONTENT_BRANCH || 'main'
  if (!repo || !process.env.GITHUB_TOKEN){
    return readLocalJson(`data/investors/${slug}.json`)
  }
  return loadInvestorFromRepo(repo, slug, branch)
}

export async function handler(event){
  try {
    if (event.httpMethod && event.httpMethod !== 'GET'){
      return text(405, 'Method not allowed')
    }

    const querySlug = normalizeSlug(event.queryStringParameters?.slug)
    const slug = querySlug || defaultSlug()
    const data = await loadInvestor(slug)

    return ok(data)
  } catch (err) {
    const message = String(err && err.message ? err.message : err)
    if (message.includes('ENOENT') || message.includes('GitHub 404')){
      return text(404, 'Inversionista no encontrado')
    }
    const status = err.statusCode || 500
    return text(status, message)
  }
}
