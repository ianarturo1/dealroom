import React from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_INVESTOR_ID } from './config'

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

const ENV_INVESTOR_SLUG = normalizeSlug(import.meta.env.VITE_PUBLIC_INVESTOR_ID)

const getPathSegments = () => {
  if (typeof window === 'undefined') return []
  return window.location.pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

const getPathSlug = () => {
  const segments = getPathSegments()
  if (segments.length === 0) return ''
  if (segments.length === 1 && segments[0].toLowerCase() === 'i') return ''
  const candidate = segments[segments.length - 1]
  if (!candidate || candidate.includes('.')) return ''
  return normalizeSlug(candidate)
}

export function useInvestorProfile(){
  const [searchParams] = useSearchParams()
  const searchSlug = React.useMemo(
    () => normalizeSlug(searchParams.get('investor')),
    [searchParams]
  )
  const pathSlug = React.useMemo(() => getPathSlug(), [])

  return React.useMemo(() => {
    if (searchSlug){
      return { investorId: searchSlug, source: 'search', isInvestorProfile: true }
    }
    if (pathSlug){
      return { investorId: pathSlug, source: 'path', isInvestorProfile: true }
    }
    if (ENV_INVESTOR_SLUG){
      return { investorId: ENV_INVESTOR_SLUG, source: 'env', isInvestorProfile: true }
    }
    return { investorId: DEFAULT_INVESTOR_ID, source: 'default', isInvestorProfile: false }
  }, [pathSlug, searchSlug])
}
