const removeDiacritics = (value) => {
  if (!value) return ''
  return value
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

const normalizeName = (value) => removeDiacritics(value).trim().toLowerCase()

const parseInvestorsArray = (items) => {
  if (!Array.isArray(items)) return []
  return items
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const slug = (item.slug || '').toString().trim().toLowerCase()
      if (!slug) return null
      return {
        slug,
        name: item.name || '',
        email: item.email || '',
        status: item.status || '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }
    })
    .filter(Boolean)
}

const parseInvestorsMap = (map) => {
  if (!map || typeof map !== 'object') return []
  return Object.entries(map).map(([slug, info]) => ({
    slug: (slug || '').toString().trim().toLowerCase(),
    name: info?.name || '',
    email: info?.email || '',
    status: info?.status || '',
    createdAt: info?.createdAt,
    updatedAt: info?.updatedAt
  })).filter(item => Boolean(item.slug))
}

const decodeIndexContent = (content) => {
  if (!content) return { entries: [], rest: {} }
  let data = null
  try {
    data = typeof content === 'string' ? JSON.parse(content) : content
  } catch {
    return { entries: [], rest: {} }
  }
  if (Array.isArray(data)){
    return { entries: parseInvestorsArray(data), rest: {} }
  }
  if (!data || typeof data !== 'object'){
    return { entries: [], rest: {} }
  }
  const { investors, ...rest } = data
  if (Array.isArray(investors)){
    return { entries: parseInvestorsArray(investors), rest }
  }
  return { entries: parseInvestorsMap(investors), rest }
}

const buildIndexPayload = (entries, rest = {}) => {
  const seen = new Set()
  const investors = {}
  entries.forEach(entry => {
    if (!entry || !entry.slug) return
    if (seen.has(entry.slug)) return
    seen.add(entry.slug)
    const { slug, ...info } = entry
    investors[slug] = {
      ...info,
      name: info.name || '',
      email: info.email || '',
      status: info.status || ''
    }
  })
  return { ...rest, investors }
}

export { decodeIndexContent, buildIndexPayload, normalizeName }
