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

const decode = (s) => decodeURIComponent(String(s || '')).replace(/\+/g, ' ').trim()
const normName = (s) => String(s || '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
const normalizeDisposition = (value) => {
  const v = String(value || '').trim().toLowerCase()
  return v === 'inline' ? 'inline' : 'attachment'
}
const escapeFilename = (name) => String(name || '').replace(/"/g, '\\"')

const legacyCandidate = (dirNew, slug, category) => {
  const legacy = joinPath('data/docs', slug, category)
  if (!legacy) return ''
  if (legacy === dirNew) return ''
  return legacy
}

const findMatch = (items, filename) => {
  if (!Array.isArray(items)) return undefined
  return (
    items.find((i) => i.type === 'file' && i.name === filename) ||
    items.find((i) => i.type === 'file' && normName(i.name) === filename)
  )
}

const buildFileResponse = (fileData, disposition, fallbackName) => {
  if (fileData?.download_url) {
    return new Response(null, { status: 302, headers: { Location: fileData.download_url } })
  }
  const buf = Buffer.from(fileData?.content || '', 'base64')
  const safeName = escapeFilename(fileData?.name || fallbackName)
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${safeName}"`,
    },
  })
}

async function fetchListing(owner, repo, path) {
  if (!path) return { exists: false, items: [] }
  try {
    const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
    if (!Array.isArray(res.data)) {
      return { exists: true, items: [] }
    }
    return { exists: true, items: res.data }
  } catch (err) {
    if (err?.status === 404) {
      return { exists: false, items: [] }
    }
    throw err
  }
}

async function fetchFile(owner, repo, path) {
  const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
  return res.data
}

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = decode(params.get('category'))
  const rawSlug = decode(params.get('slug'))
  const filename = normName(decode(params.get('filename')))
  const disposition = normalizeDisposition(params.get('disposition'))

  let category
  try {
    category = ensureCategory(rawCategory)
  } catch (err) {
    const status = err?.statusCode || err?.status || 400
    return json({ ok: false, error: err?.message || 'Missing category' }, { status })
  }

  if (!filename) {
    return json({ ok: false, error: 'Missing filename' }, { status: 400 })
  }

  if (/[\\/]/.test(filename)) {
    return json({ ok: false, error: 'Invalid filename' }, { status: 400 })
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
  let baseDir = ''
  let legacyUsed = false

  const attemptDirectory = async (path, legacy) => {
    if (!path) return { status: 'skip' }

    pathsTried.push(path)
    const directPath = joinPath(path, filename)

    if (directPath) {
      try {
        const direct = await gh.repos.getContent({ owner, repo, path: directPath, ref: BRANCH })
        if (direct?.data?.type === 'file') {
          return { status: 'found', response: buildFileResponse(direct.data, disposition, filename), baseDir: path, legacy }
        }
      } catch (err) {
        if (err?.status && err.status !== 404) {
          return { status: 'error', error: err, pathTried: directPath }
        }
      }
    }

    let listing
    try {
      listing = await fetchListing(owner, repo, path)
    } catch (err) {
      const status = err?.status || err?.statusCode || 500
      return { status: 'error', error: err, pathTried: path, httpStatus: status }
    }

    if (!baseDir && listing.exists) {
      baseDir = path
      legacyUsed = legacy
    }

    const hit = findMatch(listing.items, filename)
    if (hit) {
      try {
        const fileData = hit.download_url ? hit : await fetchFile(owner, repo, hit.path)
        return { status: 'found', response: buildFileResponse(fileData, disposition, hit.name), baseDir: path, legacy }
      } catch (err) {
        const status = err?.status || err?.statusCode || 500
        return { status: 'error', error: err, pathTried: hit.path, httpStatus: status, baseDir: path }
      }
    }

    return { status: listing.exists ? 'not-found' : 'missing', listing: listing.items, baseDir: listing.exists ? path : '', legacy }
  }

  const primary = await attemptDirectory(dirNew, false)
  if (primary.status === 'found') {
    return primary.response
  }
  if (primary.status === 'error') {
    const status = primary.httpStatus || primary.error?.status || primary.error?.statusCode || 500
    return json(
      {
        ok: false,
        error: primary.error?.message || String(primary.error),
        status,
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathTried: primary.pathTried,
      },
      { status },
    )
  }
  if (primary.baseDir) {
    baseDir = primary.baseDir
    legacyUsed = primary.legacy
  }

  let fallback
  if (legacyDir) {
    const shouldFallback =
      primary.status === 'missing' ||
      primary.status === 'skip' ||
      primary.status === 'not-found' ||
      !primary.listing ||
      primary.listing.length === 0
    if (shouldFallback) {
      fallback = await attemptDirectory(legacyDir, true)
      if (fallback.status === 'found') {
        return fallback.response
      }
      if (fallback.status === 'error') {
        const status = fallback.httpStatus || fallback.error?.status || fallback.error?.statusCode || 500
        return json(
          {
            ok: false,
            error: fallback.error?.message || String(fallback.error),
            status,
            repoUsed: OWNER_REPO,
            branchUsed: BRANCH,
            pathTried: fallback.pathTried,
          },
          { status },
        )
      }
      if (fallback.baseDir && !baseDir) {
        baseDir = fallback.baseDir
        legacyUsed = fallback.legacy
      }
    }
  }

  if (!baseDir) {
    return json(
      {
        ok: false,
        error: 'Directory not found',
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        tried: pathsTried,
        filename,
      },
      { status: 404 },
    )
  }

  return json(
    {
      ok: false,
      error: 'File not found',
      repoUsed: OWNER_REPO,
      branchUsed: BRANCH,
      pathDir: baseDir,
      filename,
      legacyFallbackUsed: legacyUsed,
      pathsTried,
    },
    { status: 404 },
  )
}
