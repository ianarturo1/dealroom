import { putFileBuffer } from './_shared/github.mjs'
import { readSingleFileFromFormData, json, badRequest, methodNotAllowed, errorJson } from './_shared/http.mjs'
import { ensureSlugAllowed } from './_shared/slug.mjs'

const DEFAULT_CONTENT_TYPE = 'application/octet-stream'
const cors = { 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*' }

function sanitizeCategory(value) {
  const category = (value ?? '').toString().trim()
  if (!category) {
    throw new Error('Missing category')
  }
  if (/[/\\]/.test(category)) {
    const error = new Error('Invalid category')
    error.code = 'BadRequest'
    throw error
  }
  return category
}

function ensureFilename(file) {
  const name = file?.name ?? ''
  const trimmed = name.trim()
  if (!trimmed) {
    const error = new Error('Missing file')
    error.code = 'BadRequest'
    throw error
  }
  if (/[/\\]/.test(trimmed)) {
    const error = new Error('Invalid filename')
    error.code = 'BadRequest'
    throw error
  }
  return trimmed
}

export default async function handler(request) {
  const method = request.method?.toUpperCase()

  if (method === 'OPTIONS') {
    const headers = new Headers(cors)
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
    return methodNotAllowed(['POST'], { headers: cors })
  }

  try {
    const { form, file, buffer } = await readSingleFileFromFormData(request)

    const slugParam = form?.get('slug')
    if (!slugParam) {
      return badRequest('Missing slug', {}, { headers: cors })
    }
    const normalizedSlug = String(slugParam).trim()
    if (!normalizedSlug) {
      return badRequest('Missing slug', {}, { headers: cors })
    }
    const slug = ensureSlugAllowed(normalizedSlug)

    const categoryParam = form?.get('category')
    if (!categoryParam) {
      return badRequest('Missing category', {}, { headers: cors })
    }
    let category
    try {
      category = sanitizeCategory(categoryParam)
    } catch (error) {
      if (error.message === 'Missing category') {
        return badRequest('Missing category', {}, { headers: cors })
      }
      if (error.code === 'BadRequest') {
        return badRequest(error.message, {}, { headers: cors })
      }
      throw error
    }

    if (!file) {
      return badRequest('Missing file', {}, { headers: cors })
    }

    let filename
    try {
      filename = ensureFilename(file)
    } catch (error) {
      if (error.message === 'Missing file' || error.code === 'BadRequest') {
        return badRequest(error.message, {}, { headers: cors })
      }
      throw error
    }

    if (!buffer || buffer.length === 0) {
      return badRequest('Empty file', {}, { headers: cors })
    }

    const ROOT = (process.env.DOCS_ROOT_DIR || 'data/docs').replace(/^\/+|\/+$/g, '')
    const path = `${ROOT}/${slug}/${category}/${filename}`
    const message = `docs(${slug}): upload ${category}/${filename} from Dealroom UI`
    const contentType = file.type || DEFAULT_CONTENT_TYPE

    const result = await putFileBuffer(path, buffer, message, contentType)
    const commit = result?.data?.commit?.sha ?? result?.data?.commit ?? null

    return json({ ok: true, slug, category, filename, commit }, { headers: cors })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403, {}, { headers: cors })
    }

    const status = error?.statusCode || error?.status || 500
    const message = status === 500 ? 'Internal error' : error?.message || 'Error'
    const normalizedStatus = status >= 400 && status < 600 ? status : 500
    return errorJson(message, normalizedStatus, {}, { headers: cors })
  }
}
