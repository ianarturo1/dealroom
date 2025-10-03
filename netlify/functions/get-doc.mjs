import { getFileBuffer } from './_shared/github.mjs'
import { binary, badRequest, errorJson, getUrlAndParams, methodNotAllowed, notFound } from './_shared/http.mjs'
import { ensureSlugAllowed } from './_shared/slug.mjs'

const cors = { 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*' }

function guessContentType(filename) {
  const extension = filename.split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'application/pdf'
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  return 'application/octet-stream'
}

function sanitizeSegment(value, field) {
  const segment = value?.trim()
  if (!segment) {
    const error = new Error(`Missing ${field}`)
    error.statusCode = 400
    throw error
  }
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    const error = new Error(`Invalid ${field}`)
    error.statusCode = 400
    throw error
  }
  return segment
}

export default async function handler(request) {
  const method = request.method?.toUpperCase()

  if (method === 'OPTIONS') {
    const headers = new Headers(cors)
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    const requestedHeaders = request.headers.get('Access-Control-Request-Headers')
    if (requestedHeaders) {
      headers.set('Access-Control-Allow-Headers', requestedHeaders)
    } else {
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    }
    return new Response(null, { status: 204, headers })
  }

  if (method && method !== 'GET') {
    return methodNotAllowed(['GET'], { headers: cors })
  }

  try {
    const { params } = getUrlAndParams(request)
    const slugParam = params.get('slug')
    const categoryParam = params.get('category')
    const filenameParam = params.get('filename')
    const dispositionParam = params.get('disposition')

    if (!slugParam) return badRequest('Missing slug', {}, { headers: cors })
    if (!categoryParam) return badRequest('Missing category', {}, { headers: cors })
    if (!filenameParam) return badRequest('Missing filename', {}, { headers: cors })

    const slug = ensureSlugAllowed(slugParam.trim())
    const category = sanitizeSegment(categoryParam, 'category')
    const filename = sanitizeSegment(filenameParam, 'filename')

    const disposition = dispositionParam?.toLowerCase() === 'inline' ? 'inline' : 'attachment'
    const path = `docs/${slug}/${category}/${filename}`

    let buffer
    try {
      buffer = await getFileBuffer(path)
    } catch (error) {
      if (error?.status === 404 || error?.statusCode === 404) {
        return notFound('File not found', {}, { headers: cors })
      }
      throw error
    }

    if (!buffer || buffer.length === 0) {
      return badRequest('Empty file', {}, { headers: cors })
    }

    const contentType = guessContentType(filename)

    return binary(buffer, {
      filename,
      contentType,
      disposition,
      headers: cors,
    })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403, {}, { headers: cors })
    }

    if (error?.statusCode === 400 || error?.status === 400) {
      return badRequest(error.message || 'Bad Request', {}, { headers: cors })
    }

    return errorJson('Internal error', 500, {}, { headers: cors })
  }
}
