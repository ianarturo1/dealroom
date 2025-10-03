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
    const categoryParam = params.get('category')

    if (!slugParam) {
      return badRequest('Missing slug')
    }

    if (!categoryParam) {
      return badRequest('Missing category')
    }

    const slug = ensureSlugAllowed(slugParam.trim())
    const category = categoryParam.trim()

    if (!category) {
      return badRequest('Missing category')
    }

    const path = `docs/${slug}/${category}`

    let items
    try {
      items = await listRepoPath(path)
    } catch (error) {
      if (error?.status === 404) {
        return notFound('No files found')
      }
      throw error
    }

    const files = Array.isArray(items)
      ? items
          .filter((item) => item && item.type === 'file')
          .map((item) => ({
            filename: item.name,
            size: item.size ?? 0,
            sha: item.sha ?? '',
            path: item.path ?? `${path}/${item.name ?? ''}`,
          }))
      : []

    if (!files.length) {
      return notFound('No files found')
    }

    return json({ ok: true, slug, category, files })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403)
    }

    const status = error?.statusCode || error?.status || 500
    const message = status === 500 ? 'Internal error' : error?.message || 'Error'
    return errorJson(message, status)
  }
}
