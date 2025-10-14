import { Octokit } from 'octokit'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'
import {
  joinPath,
  stripDealroom,
  BASE_DIR,
  parseSlug,
  ensureCategory,
} from './_shared/doc-paths.mjs'

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

const legacyCandidate = (dirNew, slug, category) => {
  const legacy = joinPath('data/docs', slug, category)
  if (!legacy) return ''
  if (legacy === dirNew) return ''
  return legacy
}

async function fetchDir(owner, repo, path) {
  if (!path) return { files: [], exists: false }

  try {
    const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
    const items = Array.isArray(res.data) ? res.data : []
    const files = items
      .filter((item) => item.type === 'file')
      .map((item) => ({
        name: item.name,
        size: item.size,
        path: item.path,
        sha: item.sha,
        download_url: item.download_url,
      }))
    return { files, exists: true }
  } catch (err) {
    if (err?.status === 404) {
      return { files: [], exists: false }
    }
    throw err
  }
}

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = params.get('category')
  const rawSlug = params.get('slug')

  let category
  try {
    category = ensureCategory(rawCategory)
  } catch (err) {
    const status = err?.statusCode || err?.status || 400
    return json({ ok: false, error: err?.message || 'Falta category' }, { status })
  }

  let slug = ''
  try {
    slug = parseSlug(rawSlug)
  } catch (err) {
    const status = err?.statusCode || err?.status || 400
    return json({ ok: false, error: err?.message || 'Slug inválido' }, { status })
  }

  const dirNew = stripDealroom(joinPath(BASE_DIR, category, slug))
  const legacyDir = legacyCandidate(dirNew, slug, category)

  const [owner, repo] = OWNER_REPO.split('/')
  const pathsTried = []
  const seen = new Map()
  let pathUsed = ''
  let legacyUsed = false

  const handleDir = async (path, legacy) => {
    if (!path) return { files: [], exists: false }

    pathsTried.push(path)
    try {
      const listing = await fetchDir(owner, repo, path)
      for (const file of listing.files) {
        const key = `${file.name}:${file.sha || file.path}`
        if (!seen.has(key)) {
          seen.set(key, { ...file, sourcePath: path })
          if (!pathUsed) {
            pathUsed = path
            legacyUsed = legacy
          }
        }
      }
      return listing
    } catch (err) {
      const status = err?.status || err?.statusCode || 500
      throw Object.assign(err, {
        status,
        pathTried: path,
      })
    }
  }

  const primary = await handleDir(dirNew, false).catch((err) => err)
  if (primary instanceof Error) {
    return json(
      {
        ok: false,
        error: primary?.message || String(primary),
        status: primary.status || 500,
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathTried: primary.pathTried,
      },
      { status: primary.status || 500 },
    )
  }

  let fallback
  if ((!primary.exists || primary.files.length === 0) && legacyDir) {
    fallback = await handleDir(legacyDir, true).catch((err) => err)
    if (fallback instanceof Error) {
      return json(
        {
          ok: false,
          error: fallback?.message || String(fallback),
          status: fallback.status || 500,
          repoUsed: OWNER_REPO,
          branchUsed: BRANCH,
          pathTried: fallback.pathTried,
        },
        { status: fallback.status || 500 },
      )
    }
  }

  const files = Array.from(seen.values())
  const legacyFallbackUsed = Boolean(legacyUsed)
  const scope = slug ? 'investor' : 'category'

  return json({
    ok: true,
    repoUsed: OWNER_REPO,
    branchUsed: BRANCH,
    pathUsed,
    pathsTried,
    legacyFallbackUsed,
    scope,
    files,
  })
}
