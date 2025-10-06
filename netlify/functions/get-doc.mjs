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

const decode = (s) => decodeURIComponent(String(s || '')).replace(/\+/g, ' ').trim()
const cleanCat = (s) => String(s || '').trim().replace(/^\/+|\/+$/g, '')
const cleanSlug = (s) => String(s || '').trim().toLowerCase().replace(/^\/+|\/+$/g, '')
const normName = (s) => String(s || '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
const normalizeDisposition = (value) => {
  const v = String(value || '').trim().toLowerCase()
  return v === 'inline' ? 'inline' : 'attachment'
}
const escapeFilename = (name) => String(name || '').replace(/"/g, '\\"')

export default async function handler(request) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const category = cleanCat(decode(params.get('category')))
  const slug = cleanSlug(decode(params.get('slug')))
  const filename = normName(decode(params.get('filename')))
  const disposition = normalizeDisposition(params.get('disposition'))

  if (!category || !filename) {
    return json({ ok: false, error: 'Missing category or filename' }, { status: 400 })
  }

  const candidates = [
    [ROOT, category, slug].filter(Boolean).join('/'),
    [ROOT, category].filter(Boolean).join('/'),
    [category, slug].filter(Boolean).join('/'),
    [category].filter(Boolean).join('/'),
    [ROOT, 'data', 'docs', slug, category].filter(Boolean).join('/'),
  ]

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

  const directPath = [baseDir, filename].filter(Boolean).join('/')
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
