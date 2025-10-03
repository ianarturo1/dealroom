import { getFileBuffer } from './_shared/github.mjs'
import { binary, badRequest, errorJson, getUrlAndParams, methodNotAllowed, notFound } from './_shared/http.mjs'
import { ensureSlugAllowed } from './_shared/slug.mjs'

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
  if (segment.includes('..') || segment.includes('/') || segment.includes('\')) {
    const error = new Error(`Invalid ${field}`)
    error.statusCode = 400
    throw error
  }
  return segment
}

export default async function handler(request) {
  if (request.method && request.method.toUpperCase() !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  try {
    const { params } = getUrlAndParams(request)
    const slugParam = params.get('slug')
    const categoryParam = params.get('category')
    const filenameParam = params.get('filename')
    const dispositionParam = params.get('disposition')

    if (!slugParam) return badRequest('Missing slug')
    if (!categoryParam) return badRequest('Missing category')
    if (!filenameParam) return badRequest('Missing filename')

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
        return notFound('File not found')
      }
      throw error
    }

    if (!buffer || buffer.length === 0) {
      return badRequest('Empty file')
    }

    const contentType = guessContentType(filename)

    return binary(buffer, {
      filename,
      contentType,
      disposition,
    })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403)
    }

    if (error?.statusCode === 400 || error?.status === 400) {
      return badRequest(error.message || 'Bad Request')
    }

    return errorJson('Internal error', 500)
  }
}
