import { Octokit } from 'octokit'
import { readSingleFileFromFormData, json, methodNotAllowed } from './_shared/http.mjs'
import {
  joinPath,
  stripDealroom,
  BASE_DIR,
  ensureSlugAllowed,
  ensureCategory,
  ensureFilename,
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

const cors = { 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*' }

const REPO_FULL = requiredEnv('DOCS_REPO')
const DOCS_BRANCH = requiredEnv('DOCS_BRANCH')
const TOKEN = requiredEnv('GITHUB_TOKEN')

const [owner, repo] = REPO_FULL.split('/')
if (!owner || !repo) {
  throw Object.assign(new Error('Invalid DOCS_REPO'), { status: 500 })
}

function buildCorsHeaders() {
  return new Headers(cors)
}

async function main(request, context) {
  const { form, file } = await readSingleFileFromFormData(request)

  const slugValue = form?.get('slug')
  const categoryValue = form?.get('category')

  if (!slugValue || !categoryValue || !file) {
    return json(
      { ok: false, error: 'Missing fields: slug, category, file' },
      { status: 400, headers: buildCorsHeaders() },
    )
  }

  const slugString = typeof slugValue === 'string' ? slugValue : String(slugValue)
  const normalizedSlug = slugString.trim()

  const categoryString = typeof categoryValue === 'string' ? categoryValue : String(categoryValue)

  let safeSlug = ''
  try {
    safeSlug = ensureSlugAllowed(normalizedSlug)
  } catch (e) {
    const code = e?.statusCode || e?.status || 403
    return json(
      { ok: false, error: e?.message || 'ForbiddenSlug' },
      { status: code, headers: buildCorsHeaders() },
    )
  }

  if (!safeSlug) {
    return json(
      { ok: false, error: 'Missing slug' },
      { status: 400, headers: buildCorsHeaders() },
    )
  }

  let safeCategory
  try {
    safeCategory = ensureCategory(categoryString)
  } catch (e) {
    const code = e?.statusCode || e?.status || 400
    return json(
      { ok: false, error: e?.message || 'Invalid category' },
      { status: code, headers: buildCorsHeaders() },
    )
  }

  const filename = typeof file.name === 'string' ? file.name : 'upload.bin'
  let safeFilename
  try {
    safeFilename = ensureFilename(filename)
  } catch (e) {
    const code = e?.statusCode || e?.status || 400
    return json(
      { ok: false, error: e?.message || 'Invalid filename' },
      { status: code, headers: buildCorsHeaders() },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const content = buffer.toString('base64')

  const dir = stripDealroom(joinPath(BASE_DIR, safeCategory, safeSlug))
  const path = joinPath(dir, safeFilename)

  const octokit = new Octokit({ auth: TOKEN })

  let sha
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path, ref: DOCS_BRANCH })
    if (Array.isArray(res.data)) {
      const e = new Error('Path points to a directory')
      e.status = 400
      throw e
    }
    sha = res.data.sha
  } catch (err) {
    const status = err?.status || err?.statusCode
    if (status && status !== 404) throw err
  }

  const message = `chore(upload-doc): ${joinPath(safeCategory, safeSlug, safeFilename)}`
  const payload = { owner, repo, path, message, content, branch: DOCS_BRANCH }
  if (sha) payload.sha = sha

  const writeRes = await octokit.rest.repos.createOrUpdateFileContents(payload)

  return json(
    { ok: true, path, commit: writeRes?.data?.commit },
    { status: 200, headers: buildCorsHeaders() },
  )
}

export default async function handler(request, context) {
  const method = request.method?.toUpperCase()

  if (method === 'OPTIONS') {
    const headers = buildCorsHeaders()
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
    if (requestedHeaders) {
      headers.set('Access-Control-Allow-Headers', requestedHeaders)
    } else {
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    return new Response(null, { status: 204, headers })
  }

  if (method !== 'POST') {
    return methodNotAllowed(['POST'], { headers: buildCorsHeaders() })
  }

  try {
    return await main(request, context)
  } catch (err) {
    const code = err?.status || err?.statusCode || 500
    const msg = err?.message || 'Internal Error'
    console.error('[upload-doc]', { status: code, message: msg })
    return json({ ok: false, error: msg }, { status: code, headers: buildCorsHeaders() })
  }
}
