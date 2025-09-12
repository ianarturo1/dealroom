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
function requireUser(context){
  const user = context.clientContext && context.clientContext.user
  if (!user) throw new Error('No autorizado')
  return user
}
function hasAnyRole(user, wanted){
  const roles = (user && user.app_metadata && user.app_metadata.roles) || []
  return roles.some(r => wanted.includes(r))
}
function emailDomain(user){
  const email = user.email || ''
  const ix = email.indexOf('@')
  return ix >= 0 ? email.slice(ix+1).toLowerCase() : ''
}
import fs from 'fs/promises'
import path from 'path'
async function readLocalJson(relPath){
  const file = path.join(process.cwd(), relPath)
  const txt = await fs.readFile(file, 'utf-8')
  return JSON.parse(txt)
}
export { ok, text, requireUser, hasAnyRole, emailDomain, readLocalJson }
