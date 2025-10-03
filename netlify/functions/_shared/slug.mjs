export function ensureSlugAllowed(inputSlug) {
  const slug = inputSlug ?? ''
  const allowed = new Set()

  const singleSlug = process.env.PUBLIC_INVESTOR_SLUG?.trim()
  if (singleSlug) allowed.add(singleSlug)

  const multipleSlugs = process.env.PUBLIC_INVESTOR_SLUGS?.split(',') ?? []
  for (const slug of multipleSlugs) {
    const trimmed = slug.trim()
    if (trimmed) allowed.add(trimmed)
  }

  if (allowed.size === 0) return slug

  if (!allowed.has(slug)) {
    const error = new Error('ForbiddenSlug')
    error.statusCode = 403
    throw error
  }

  return slug
}
