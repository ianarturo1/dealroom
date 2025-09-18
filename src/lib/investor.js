import React from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { DEFAULT_INVESTOR_ID } from './config'

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

const getPathSlug = (pathname) => {
  const segments = (pathname || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
  if (segments.length >= 2 && segments[0].toLowerCase() === 'i'){
    return normalizeSlug(segments[1])
  }
  return ''
}

const getEnvSlug = () => {
  const candidates = [
    import.meta.env.VITE_PUBLIC_INVESTOR_ID,
    import.meta.env.PUBLIC_INVESTOR_SLUG
  ]
  for (const candidate of candidates){
    const normalized = normalizeSlug(candidate)
    if (normalized) return normalized
  }
  return ''
}

export function useInvestorProfile(){
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const searchSlug = React.useMemo(
    () => normalizeSlug(searchParams.get('investor')),
    [searchParams]
  )
  const pathSlug = React.useMemo(
    () => getPathSlug(location.pathname),
    [location.pathname]
  )
  const envSlug = React.useMemo(() => getEnvSlug(), [])

  return React.useMemo(() => {
    if (pathSlug){
      return { investorId: pathSlug, source: 'path', isInvestorProfile: true }
    }
    if (searchSlug){
      return { investorId: searchSlug, source: 'search', isInvestorProfile: true }
    }
    if (envSlug){
      return { investorId: envSlug, source: 'env', isInvestorProfile: true }
    }
    return { investorId: DEFAULT_INVESTOR_ID, source: 'default', isInvestorProfile: false }
  }, [envSlug, pathSlug, searchSlug])
}
