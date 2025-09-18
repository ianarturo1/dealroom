const envCandidates = [
  import.meta.env.VITE_PUBLIC_INVESTOR_ID,
  import.meta.env.PUBLIC_INVESTOR_SLUG
]

const normalized = envCandidates
  .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
  .find(Boolean)

export const DEFAULT_INVESTOR_ID = normalized || 'femsa'
