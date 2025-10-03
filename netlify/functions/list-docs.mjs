import { listRepoPath } from './_shared/github.mjs'
import { getUrlAndParams, json, badRequest, methodNotAllowed, errorJson } from './_shared/http.mjs'
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

    const primaryPath = `${category}/${slug}`
    const legacyPath = `data/docs/${slug}/${category}`

    const toFileList = (items) =>
      Array.isArray(items)
        ? items
            .filter((item) => item && item.type === 'file')
            .map((item) => ({
              name: item.name ?? '',
              path: item.path ?? '',
              size: item.size ?? 0,
              sha: item.sha ?? '',
            }))
        : []

    let primaryItems
    try {
      primaryItems = await listRepoPath(primaryPath)
    } catch (error) {
      if (error?.status !== 404) {
        throw error
      }
    }

    let legacyItems
    try {
      legacyItems = await listRepoPath(legacyPath)
    } catch (error) {
      if (error?.status !== 404) {
        throw error
      }
    }

    const filesMap = new Map()

    for (const file of toFileList(primaryItems)) {
      if (file.path) {
        filesMap.set(file.path, file)
      }
    }

    for (const file of toFileList(legacyItems)) {
      if (file.path && !filesMap.has(file.path)) {
        filesMap.set(file.path, file)
      }
    }

    const files = Array.from(filesMap.values())

    return json({ ok: true, files })
  } catch (error) {
    if (error?.message === 'ForbiddenSlug' || error?.statusCode === 403 || error?.status === 403) {
      return errorJson('ForbiddenSlug', 403)
    }

    const status = error?.statusCode || error?.status || 500
    const message = status === 500 ? 'Internal error' : error?.message || 'Error'
    return errorJson(message, status)
  }
}
