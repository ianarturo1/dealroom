const raw = typeof import.meta.env.VITE_PUBLIC_INVESTOR_ID === 'string'
  ? import.meta.env.VITE_PUBLIC_INVESTOR_ID
  : ''

export const DEFAULT_INVESTOR_ID = raw.trim().toLowerCase() || 'femsa'
