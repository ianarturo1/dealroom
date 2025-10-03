import { listRepoPath } from './_shared/github.mjs'
import { getUrlAndParams, json, badRequest, notFound, methodNotAllowed, errorJson } from './_shared/http.mjs'
import { ensureSlugAllowed } from './_shared/slug.mjs'

export default async function handler(request) {
  if (request.method && request.method.toUpperCase() !== 'GET') {
    return methodNotAllowed(['GET'])
  }

  try {
    const { params } = getUrlAndParams(request)
    const slugParam = params.get('slug')

    if (!slugParam) {
      return badRequest('Missing slug')
    }

    const slug = ensureSlugAllowed(slugParam.trim())
    const path = `docs/${slug}`

    let items
    try {
      items = await listRepoPath(path)
    } catch (error) {
      if (error?.status === 404) {
        return notFound('No categories found')
      }
      throw error
    }

    const categories = items
      .filter((item) => item && item.type === 'dir')
      .map((item) => item.name)

    if (categories.length === 0) {
      return notFound('No categories found')
    }

    return json({ ok: true, slug, categories })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403)
    }

    const status = error?.statusCode || error?.status || 500
    const message = status === 500 ? 'Internal error' : error?.message || 'Error'
    return errorJson(message, status)
  }
}
