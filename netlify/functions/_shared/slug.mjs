export function ensureSlugAllowed(inputSlug) {
  console.warn('[ensureSlugAllowed]', {
    slug: String(inputSlug || '').trim(),
    single: String(process.env.PUBLIC_INVESTOR_SLUG || '').trim(),
    list: String(process.env.PUBLIC_INVESTOR_SLUGS || '').trim()
  })
  const slug = String(inputSlug || '').trim().toLowerCase()
  const allowedSingle = (process.env.PUBLIC_INVESTOR_SLUG || '').trim().toLowerCase()
  const allowedList = (process.env.PUBLIC_INVESTOR_SLUGS || '').trim().toLowerCase()

  // Si no hay restricciones, permitir todos
  if (!allowedSingle && !allowedList) return slug

  // Si coincide con el slug único permitido
  if (allowedSingle && slug === allowedSingle) return slug

  // Si hay lista separada por coma
  if (allowedList && allowedList.split(',').map(s => s.trim()).includes(slug)) return slug

  const err = new Error('Slug not allowed')
  err.status = 403
  throw err
}
