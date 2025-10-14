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

const sanitize = (s = '') =>
  String(s)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._() \-]/gu, '')
    .trim()
const trimSlashes = (s) => String(s || '').replace(/^\/+|\/+$/g, '')
const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .map(trimSlashes)
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/')
const BASE_DIR = trimSlashes(process.env.DOCS_BASE_DIR || process.env.DOCS_ROOT_DIR || '')

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined })
const gh = octokit.rest ? octokit.rest : octokit

const cleanCategory = (s) => {
  const value = sanitize(s)
  if (!value || value.includes('..')) return ''
  return value
}
const cleanSlug = (s) => {
  const value = sanitize(String(s || '').toLowerCase())
  if (!value) return ''
  if (value.includes('..')) return ''
  return value
}

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = params.get('category')
  const rawSlug = params.get('slug')
  const category = cleanCategory(rawCategory)
  const slug = cleanSlug(rawSlug)
  if (!category) return json({ ok: false, error: 'Falta category' }, { status: 400 })
  if (rawSlug && !slug) {
    return json({ ok: false, error: 'Slug inválido' }, { status: 400 })
  }

  const legacyBase = BASE_DIR || 'data/docs'
  const candidateSet = new Set(
    [
      joinPath(BASE_DIR, category, slug),
      joinPath(BASE_DIR, category),
      joinPath(BASE_DIR, slug, category),
      joinPath(BASE_DIR, slug),
      joinPath(category, slug),
      joinPath(category),
      joinPath(legacyBase, slug, category),
    ].filter(Boolean),
  )
  const candidates = Array.from(candidateSet)

  const [owner, repo] = OWNER_REPO.split('/')
  for (const path of candidates) {
    if (!path) continue
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
      const isInvestorScope = Boolean(
        slug &&
          (path.endsWith(`/${slug}`) || path.includes(`/${slug}/`))
      )
      const scope = isInvestorScope ? 'investor' : 'category'
      return json({ ok: true, repoUsed: OWNER_REPO, branchUsed: BRANCH, pathUsed: path, scope, files })
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
