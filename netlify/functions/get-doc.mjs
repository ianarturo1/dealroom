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

const decode = (s) => decodeURIComponent(String(s || '')).replace(/\+/g, ' ').trim()
const normName = (s) => String(s || '').replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
const normalizeDisposition = (value) => {
  const v = String(value || '').trim().toLowerCase()
  return v === 'inline' ? 'inline' : 'attachment'
}
const escapeFilename = (name) => String(name || '').replace(/"/g, '\\"')

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
  return ensureSlugAllowed(value, event)
}

function ensureFilename(value) {
  const clean = sanitize(value)
  if (!clean || clean.includes('..') || /[\\/]/.test(clean)) {
    const e = new Error('Invalid filename')
    e.status = 400
    throw e
  }
  return clean
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

async function fetchFileByPath({ owner, repo, path, ref }) {
  const res = await gh.repos.getContent({ owner, repo, path, ref })
  if (res.data?.type !== 'file') {
    const err = new Error('Not a file')
    err.status = 404
    throw err
  }
  return res.data
}

export default async function handler(request, context) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])

  const { params } = getUrlAndParams(request)
  const rawCategory = decode(params.get('category'))
  const rawSlug = decode(params.get('slug'))
  const rawFilename = decode(params.get('filename'))
  const disposition = normalizeDisposition(params.get('disposition'))

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

  let filename
  try {
    filename = ensureFilename(rawFilename)
  } catch (err) {
    const status = err?.status || err?.statusCode || 400
    return json({ ok: false, error: err?.message || 'Invalid filename' }, { status })
  }

  const [owner, repo] = OWNER_REPO.split('/')
  const dirNew = buildNewLayoutPath(category, slug)
  const dirLegacy = buildLegacyPath(category, slug)
  const directories = uniqueByPath([
    { type: 'new', path: dirNew },
    { type: 'legacy', path: dirLegacy },
  ])

  const attempts = []

  for (const entry of directories) {
    const baseDir = entry?.path
    if (!baseDir) continue
    const normalizedDir = stripDealroom(joinPath(baseDir))
    const targetPath = joinPath(baseDir, filename)
    const normalizedTargetPath = stripDealroom(targetPath)
    attempts.push({ type: entry.type, dir: normalizedDir, path: normalizedTargetPath })

    try {
      const fileData = await fetchFileByPath({ owner, repo, path: targetPath, ref: BRANCH })
      const downloadUrl = fileData.download_url
      if (downloadUrl) {
        return new Response(null, { status: 302, headers: { Location: downloadUrl } })
      }
      const buf = Buffer.from(fileData.content || '', 'base64')
      const safeName = escapeFilename(fileData.name || filename)
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `${disposition}; filename="${safeName}"`,
        },
      })
    } catch (err) {
      if (err?.status && err.status !== 404) {
        return json(
          {
            ok: false,
            error: err?.message || String(err),
            status: err.status,
            repoUsed: OWNER_REPO,
            branchUsed: BRANCH,
            pathTried: normalizedTargetPath,
            pathDir: normalizedDir,
          },
          { status: err.status },
        )
      }
    }

    try {
      const listingRes = await gh.repos.getContent({ owner, repo, path: baseDir, ref: BRANCH })
      const items = Array.isArray(listingRes.data) ? listingRes.data : []
      const targetNorm = normName(filename)
      const hit =
        items.find((item) => item.type === 'file' && item.name === filename) ||
        items.find((item) => item.type === 'file' && normName(item.name) === targetNorm)

      if (!hit) {
        continue
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
            pathDir: normalizedDir,
            pathTried: stripDealroom(hit.path || ''),
          },
          { status },
        )
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
            pathDir: normalizedDir,
          },
          { status: err.status },
        )
      }
    }
  }

  return json(
    {
      ok: false,
      error: 'File not found',
      repoUsed: OWNER_REPO,
      branchUsed: BRANCH,
      filename,
      tried: attempts.map((item) => item.path),
    },
    { status: 404 },
  )
}
