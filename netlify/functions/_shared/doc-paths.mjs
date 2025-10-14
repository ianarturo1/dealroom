export const sanitize = (s = '') =>
  String(s)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._() \-]/gu, '')
    .trim()

export const trim = (s) => String(s).replace(/^\/+|\/+$/g, '')

export const joinPath = (...parts) =>
  parts
    .filter(Boolean)
    .map(trim)
    .filter(Boolean)
    .join('/')
    .replace(/\\+/g, '/')

export const stripDealroom = (s) => trim(String(s).replace(/^dealroom\/?/i, ''))

export const RAW_BASE = process.env.DOCS_ROOT_DIR ?? process.env.DOCS_BASE_DIR ?? ''
export const BASE_DIR = stripDealroom(RAW_BASE)

const rawAllowed = (process.env.PUBLIC_INVESTOR_SLUG ?? process.env.PUBLIC_INVESTOR_SLUGS ?? '').trim()
const allowedSet = new Set(rawAllowed.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean))

export const ensureSlugAllowed = (inputSlug) => {
  const s = sanitize(inputSlug).toLowerCase()
  if (allowedSet.size && !allowedSet.has(s)) {
    const err = new Error('Slug not allowed')
    err.statusCode = 403
    throw err
  }
  return s
}

export const parseSlug = (value) => {
  if (value === undefined || value === null) return ''
  const raw = String(value)
  if (!raw.trim()) return ''
  return ensureSlugAllowed(raw)
}

export const ensureCategory = (value) => {
  const category = sanitize(value)
  if (!category) {
    const err = new Error('Missing category')
    err.statusCode = 400
    throw err
  }
  if (category.includes('..')) {
    const err = new Error('Invalid category')
    err.statusCode = 400
    throw err
  }
  return category
}

export const ensureFilename = (value) => {
  const clean = sanitize(value)
  if (!clean || clean.includes('..')) {
    const err = new Error('Invalid filename')
    err.statusCode = 400
    throw err
  }
  return clean
}
