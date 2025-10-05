import { Octokit } from 'octokit'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'

function requiredEnv(name) {
  const v = (process.env[name] || '').trim()
  if (!v) {
    const e = new Error(`Missing env ${name}`)
    e.status = 500
    throw e
  }
  return v
}

const OWNER_REPO = requiredEnv('DOCS_REPO')
const BRANCH = requiredEnv('DOCS_BRANCH')
const ROOT = requiredEnv('DOCS_ROOT_DIR').replace(/^\/+|\/+$/g, '')

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined })
const gh = octokit.rest ? octokit.rest : octokit

const cleanCat = (s) => String(s || '').trim().replace(/^\/+|\/+$/g, '')
const cleanSlug = (s) => String(s || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '')

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const category = cleanCat(params.get('category'))
  const slug = cleanSlug(params.get('slug'))
  if (!category || !slug) return json({ ok: false, error: 'Falta category o slug' }, { status: 400 })

  const candidates = [
    [ROOT, category, slug].filter(Boolean).join('/'),
    [category, slug].filter(Boolean).join('/'),
    [ROOT, 'data', 'docs', slug, category].filter(Boolean).join('/'),
  ]

  const [owner, repo] = OWNER_REPO.split('/')
  for (const path of candidates) {
    try {
      const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
      const items = Array.isArray(res.data) ? res.data : []
      const files = items
        .filter((item) => item.type === 'file')
        .map((item) => ({
          name: item.name,
          size: item.size,
          path: item.path,
          download_url: item.download_url,
        }))
      return json({ ok: true, repoUsed: OWNER_REPO, branchUsed: BRANCH, pathUsed: path, files })
    } catch (err) {
      if (err?.status === 404) continue
      return json(
        {
          ok: false,
          error: err?.message || String(err),
          status: err?.status || 500,
          repoUsed: OWNER_REPO,
          branchUsed: BRANCH,
          pathTried: path,
        },
        { status: err?.status || 500 },
      )
    }
  }

  return json({ ok: true, repoUsed: OWNER_REPO, branchUsed: BRANCH, tried: candidates, files: [] })
}
