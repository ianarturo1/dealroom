import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

function ok(data, headers){
  return {
    statusCode: 200,
    headers: Object.assign({'content-type':'application/json'}, headers || {}),
    body: JSON.stringify(data)
  }
}

function text(status, txt, headers){
  return { statusCode: status, headers: Object.assign({'content-type':'text/plain'}, headers || {}), body: txt }
}

function parseList(value){
  if (!value) return []
  return value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)
}

function base64UrlToBase64(str){
  return str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4)
}

function unauthorized(message){
  const err = new Error(message || 'No autorizado')
  err.statusCode = 401
  return err
}

function extractToken(event){
  const headers = (event && event.headers) || {}
  const auth = headers.authorization || headers.Authorization
  if (auth && auth.startsWith('Bearer ')){
    return auth.slice(7).trim()
  }
  const cookieHeader = headers.cookie || headers.Cookie || ''
  const match = cookieHeader.match(/(?:^|;\s*)t=([^;]+)/)
  if (match){
    try{ return decodeURIComponent(match[1]) }catch(_){ return match[1] }
  }
  return null
}

function verifyJwt(token){
  const parts = (token || '').split('.')
  if (parts.length !== 3) throw unauthorized('Token inválido')
  const [headerB64, payloadB64, signatureB64] = parts
  const signingInput = `${headerB64}.${payloadB64}`
  const secret = process.env.SIGNING_SECRET || '4f4fe635fe7077d4e3180151f2323c69e8a9856616f6f7b7bd56dc67f32c5221'
  const expected = crypto.createHmac('sha256', secret).update(signingInput).digest('base64')
  const expectedB64 = expected.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  if (expectedB64 !== signatureB64) throw unauthorized('Token inválido')
  const payloadJson = JSON.parse(Buffer.from(base64UrlToBase64(payloadB64), 'base64').toString('utf-8'))
  if (payloadJson.exp && Date.now() >= payloadJson.exp * 1000) throw unauthorized('Token expirado')
  return payloadJson
}

function deriveRoles(payload){
  const roles = new Set()
  const addRole = (value) => { if (typeof value === 'string' && value) roles.add(value) }

  if (payload){
    if (Array.isArray(payload.roles)) payload.roles.forEach(addRole)
    if (payload.role) addRole(payload.role)
    const metaRoles = payload.app_metadata && Array.isArray(payload.app_metadata.roles) ? payload.app_metadata.roles : []
    metaRoles.forEach(addRole)

    const aud = typeof payload.aud === 'string' ? payload.aud.toLowerCase() : ''
    if (aud === 'investor') addRole('investor')
    if (aud === 'admin'){
      addRole('admin')
      addRole('ri')
    }

    const slug = typeof payload.sub === 'string' ? payload.sub.toLowerCase() : ''
    const adminSlugs = parseList(process.env.ADMIN_SLUGS)
    if (slug && adminSlugs.includes(slug)){
      addRole('admin')
      addRole('ri')
    } else {
      const riSlugs = parseList(process.env.RI_SLUGS)
      if (slug && riSlugs.includes(slug)) addRole('ri')
    }

    const staffDomainsEnv = process.env.STAFF_DOMAINS
    const staffDomains = parseList(staffDomainsEnv === undefined ? 'fin.solar' : staffDomainsEnv)
    const email = typeof payload.email === 'string' ? payload.email : ''
    const at = email.indexOf('@')
    if (at >= 0){
      const domain = email.slice(at + 1).toLowerCase()
      if (staffDomains.includes(domain)) addRole('ri')
    }
  }

  if (!roles.size) addRole('investor')
  return Array.from(roles)
}

function requireUser(event, context){
  const identityUser = context && context.clientContext && context.clientContext.user
  if (identityUser) return identityUser

  const token = extractToken(event)
  if (!token) throw unauthorized('No autorizado')
  const payload = verifyJwt(token)
  const roles = deriveRoles(payload)
  const user = Object.assign({}, payload)
  user.app_metadata = Object.assign({}, payload.app_metadata, { roles })
  if (!user.email && typeof payload.email === 'string') user.email = payload.email
  return user
}

function hasAnyRole(user, wanted){
  const roles = (user && user.app_metadata && user.app_metadata.roles) || []
  return roles.some(r => wanted.includes(r))
}

function emailDomain(user){
  const email = user && user.email || ''
  const ix = email.indexOf('@')
  return ix >= 0 ? email.slice(ix+1).toLowerCase() : ''
}

async function readLocalJson(relPath){
  const file = path.join(process.cwd(), relPath)
  const txt = await fs.readFile(file, 'utf-8')
  return JSON.parse(txt)
}

export { ok, text, requireUser, hasAnyRole, emailDomain, readLocalJson }
