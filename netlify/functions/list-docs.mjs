import { octokit } from './_shared/github.mjs'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'

const OWNER_REPO = process.env.DOCS_REPO || process.env.CONTENT_REPO
const BRANCH = process.env.DOCS_BRANCH || process.env.CONTENT_BRANCH || 'main'
const ROOT = (process.env.DOCS_ROOT_DIR || 'dealroom').replace(/^\/+|\/+$/g, '')

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
  const path = [ROOT, category, slug].filter(Boolean).join('/')

  try {
    if (!category || !slug) {
      return json({ ok: false, error: 'Falta category o slug' }, { status: 400 })
    }

    if (!OWNER_REPO || !OWNER_REPO.includes('/')) {
      return json({ ok: false, error: 'Configuración inválida de repositorio', pathTried: path }, { status: 500 })
    }

    const [owner, repo] = OWNER_REPO.split('/')

    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref: BRANCH })
    const entries = Array.isArray(res.data) ? res.data : []
    const files = entries
      .filter((item) => item.type === 'file')
      .map((item) => ({
        name: item.name,
        size: item.size,
        path: item.path,
        download_url: item.download_url,
      }))

    return json({ ok: true, pathTried: path, files })
  } catch (error) {
    if (error?.status === 404) {
      return json({ ok: true, pathTried: path, files: [] })
    }

    return json(
      {
        ok: false,
        error: error?.message || 'Error',
        pathTried: path,
      },
      { status: error?.status || 500 },
    )
  }
}
