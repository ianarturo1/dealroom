import { Octokit } from 'octokit'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'
import {
  buildNewLayoutPath,
  buildLegacyPath,
  joinPath,
  stripDealroom,
  sanitize,
} from './_shared/paths.mjs'
import { ensureSlugAllowed } from './_shared/ensureSlugAllowed.mjs'

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

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined })
const gh = octokit.rest ? octokit.rest : octokit

function ensureCategory(value) {
  const clean = sanitize(value)
  if (!clean || clean.includes('..')) {
    const e = new Error('Invalid category')
    e.status = 400
    throw e
  }
  return clean
}

function normalizeSlug(value, event) {
  if (!value) return ''
  try {
    return ensureSlugAllowed(value, event)
  } catch (err) {
    throw err
  }
}

function uniqueByPath(entries) {
  const seen = new Set()
  const out = []
  for (const entry of entries) {
    if (!entry?.path) continue
    const key = entry.path
    if (seen.has(key)) continue
    seen.add(key)
    out.push(entry)
  }
  return out
}

export default async function handler(request, context) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = params.get('category')
  const rawSlug = params.get('slug')

  let category
  try {
    category = ensureCategory(rawCategory)
  } catch (err) {
    const status = err?.status || err?.statusCode || 400
    return json({ ok: false, error: err?.message || 'Invalid category' }, { status })
  }

  let slug = ''
  if (rawSlug) {
    try {
      slug = normalizeSlug(rawSlug, { request, context })
    } catch (err) {
      const status = err?.status || err?.statusCode || 403
      return json({ ok: false, error: err?.message || 'Slug inválido' }, { status })
    }
  }

  const dirNew = buildNewLayoutPath(category, slug)
  const dirLegacy = buildLegacyPath(category, slug)
  const directories = uniqueByPath([
    { type: 'new', path: dirNew },
    { type: 'legacy', path: dirLegacy },
  ])

  const [owner, repo] = OWNER_REPO.split('/')
  const attempted = []
  const hits = []
  const filesMap = new Map()
  let firstHitPath = ''

  for (const entry of directories) {
    const path = entry?.path
    if (!path) continue
    const normalizedDirPath = stripDealroom(joinPath(path))
    attempted.push({ type: entry.type, path: normalizedDirPath })
    try {
      const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
      const items = Array.isArray(res.data) ? res.data : []
      const fileItems = items.filter((item) => item.type === 'file')
      if (fileItems.length > 0 && !firstHitPath) {
        firstHitPath = normalizedDirPath
      }
      if (fileItems.length > 0) {
        hits.push({ type: entry.type, path: normalizedDirPath, count: fileItems.length })
      }
      for (const item of fileItems) {
        const normalizedPath = stripDealroom(item.path || '')
        const key = item.sha || normalizedPath
        if (filesMap.has(key)) continue
        filesMap.set(key, {
          name: item.name,
          size: item.size,
          path: normalizedPath,
          download_url: item.download_url,
          sha: item.sha,
          source: entry.type,
        })
      }
    } catch (err) {
      if (err?.status === 404) {
        continue
      }
      return json(
        {
          ok: false,
          error: err?.message || String(err),
          status: err?.status || 500,
          repoUsed: OWNER_REPO,
          branchUsed: BRANCH,
          pathTried: normalizedDirPath,
        },
        { status: err?.status || 500 },
      )
    }
  }

  const files = Array.from(filesMap.values())
  const scope = slug ? 'investor' : 'category'

  return json({
    ok: true,
    repoUsed: OWNER_REPO,
    branchUsed: BRANCH,
    scope,
    files,
    tried: attempted.map((item) => item.path),
    hits,
    firstHitPath: firstHitPath || null,
  })
}
