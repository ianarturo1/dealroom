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

const decode = (s) => decodeURIComponent(String(s || '')).replace(/\+/g, ' ').trim()
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
const normName = (s) => String(s || '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
const normalizeDisposition = (value) => {
  const v = String(value || '').trim().toLowerCase()
  return v === 'inline' ? 'inline' : 'attachment'
}
const escapeFilename = (name) => String(name || '').replace(/"/g, '\\"')

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = decode(params.get('category'))
  const rawSlug = decode(params.get('slug'))
  const category = cleanCategory(rawCategory)
  const slug = cleanSlug(rawSlug)
  const filename = normName(decode(params.get('filename')))
  const disposition = normalizeDisposition(params.get('disposition'))

  if (!category || !filename) {
    return json({ ok: false, error: 'Missing category or filename' }, { status: 400 })
  }
  if (rawSlug && !slug) {
    return json({ ok: false, error: 'Slug inválido' }, { status: 400 })
  }
  if (/[\\/]/.test(filename)) {
    return json({ ok: false, error: 'Invalid filename' }, { status: 400 })
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
  let baseDir = ''
  let dirListing = null

  for (const path of candidates) {
    if (!path) continue
    try {
      const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH })
      if (!Array.isArray(res.data)) continue
      baseDir = path
      dirListing = res.data
      break
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

  if (!baseDir) {
    return json(
      {
        ok: false,
        error: 'Directory not found',
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        tried: candidates,
        filename,
      },
      { status: 404 },
    )
  }

  const allowDirect = !filename.includes('..')
  const directPath = allowDirect ? joinPath(baseDir, filename) : ''
  if (directPath) {
    try {
      const res = await gh.repos.getContent({ owner, repo, path: directPath, ref: BRANCH })
      if (res.data?.type === 'file') {
        const dl = res.data.download_url
        if (dl) {
          return new Response(null, { status: 302, headers: { Location: dl } })
        }
        const buf = Buffer.from(res.data.content || '', 'base64')
        const safeName = escapeFilename(res.data?.name || filename)
        return new Response(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `${disposition}; filename="${safeName}"`,
          },
        })
      }
    } catch (err) {
      if (err?.status && err.status !== 404) {
        return json(
          {
            ok: false,
            error: err?.message || String(err),
            status: err.status,
            repoUsed: OWNER_REPO,
            branchUsed: BRANCH,
            pathTried: directPath,
            pathDir: baseDir,
          },
          { status: err.status },
        )
      }
    }
  }

  let items = Array.isArray(dirListing) ? dirListing : null
  if (!items) {
    try {
      const res = await gh.repos.getContent({ owner, repo, path: baseDir, ref: BRANCH })
      items = Array.isArray(res.data) ? res.data : []
    } catch (err) {
      const status = err?.status || 500
      return json(
        {
          ok: false,
          error: err?.message || String(err),
          status,
          repoUsed: OWNER_REPO,
          branchUsed: BRANCH,
          pathDir: baseDir,
        },
        { status },
      )
    }
  }

  const hit = items.find((i) => i.type === 'file' && i.name === filename) ||
    items.find((i) => i.type === 'file' && normName(i.name) === filename)

  if (!hit) {
    return json({ ok: false, error: 'File not found', pathDir: baseDir, filename }, { status: 404 })
  }

  if (hit.download_url) {
    return new Response(null, { status: 302, headers: { Location: hit.download_url } })
  }

  try {
    const fileRes = await gh.repos.getContent({ owner, repo, path: hit.path, ref: BRANCH })
    const buf = Buffer.from(fileRes.data.content || '', 'base64')
    const safeName = escapeFilename(hit.name || filename)
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${safeName}"`,
      },
    })
  } catch (err) {
    const status = err?.status || 500
    return json(
      {
        ok: false,
        error: err?.message || String(err),
        status,
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathDir: baseDir,
        pathTried: hit.path,
      },
      { status },
    )
  }
}
