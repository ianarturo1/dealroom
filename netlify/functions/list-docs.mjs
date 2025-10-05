import { octokit } from './_shared/github.mjs'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'

function requiredEnv(name) {
  const value = (process.env[name] || '').trim()
  if (!value) {
    const error = new Error(`Missing env ${name}`)
    error.status = 500
    throw error
  }
  return value
}

const OWNER_REPO = requiredEnv('DOCS_REPO')
const BRANCH = requiredEnv('DOCS_BRANCH')
const ROOT = requiredEnv('DOCS_ROOT_DIR').replace(/^\/+|\/+$/g, '')

function cleanCat(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '')
}

function cleanSlug(value) {
  return String(value || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '')
}

export default async function handler(request) {
  if (request.method && request.method.toUpperCase() !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  const { params } = getUrlAndParams(request)
  const category = cleanCat(params.get('category'))
  const slug = cleanSlug(params.get('slug'))

  if (!category || !slug) {
    return json({ ok: false, error: 'Falta category o slug' }, { status: 400 })
  }

  const path = [ROOT, category, slug].filter(Boolean).join('/')
  const [owner, repo] = OWNER_REPO.split('/')
  if (!owner || !repo) {
    return json(
      {
        ok: false,
        error: 'Configuración inválida de DOCS_REPO',
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathTried: path,
      },
      { status: 500 },
    )
  }

  try {
    const res = await octokit.repos.getContent({ owner, repo, path, ref: BRANCH })
    const items = Array.isArray(res.data) ? res.data : []
    const files = items
      .filter((item) => item.type === 'file')
      .map((item) => ({
        name: item.name,
        size: item.size,
        path: item.path,
        download_url: item.download_url,
      }))

    return json({ ok: true, repoUsed: OWNER_REPO, branchUsed: BRANCH, pathTried: path, files })
  } catch (error) {
    if (error?.status === 404) {
      return json({ ok: true, repoUsed: OWNER_REPO, branchUsed: BRANCH, pathTried: path, files: [] })
    }

    return json(
      {
        ok: false,
        error: error?.message || 'Error',
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathTried: path,
      },
      { status: error?.status || 500 },
    )
  }
}
