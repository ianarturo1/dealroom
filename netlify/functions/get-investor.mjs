import { Buffer } from 'node:buffer'
import { readLocalJson } from './_lib/utils.mjs'
import { repoEnv, getFile } from './_lib/github.mjs'
import { json, errorJson, notFound, methodNotAllowed, getUrlAndParams } from './_shared/http.mjs'

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

export default async function handler(request, context){
  try {
    if (request.method && request.method !== 'GET'){
      return methodNotAllowed(['GET'])
    }

    const { params } = getUrlAndParams(request)
    const querySlug = normalizeSlug(params.get('slug'))
    const slug = querySlug || defaultSlug()
    const data = await loadInvestor(slug)

    return json(data)
  } catch (err) {
    const message = String(err && err.message ? err.message : err)
    if (message.includes('ENOENT') || message.includes('GitHub 404')){
      return notFound('Inversionista no encontrado')
    }
    const status = err.statusCode || 500
    return errorJson(message || 'Internal error', status)
  }
}
