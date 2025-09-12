import React from 'react'

export default function RoleGate({ user, allow = [], children }){
  const roles = (user && user.app_metadata && user.app_metadata.roles) || []
  const ok = allow.length === 0 || roles.some(r => allow.includes(r))
  if (!ok) return <div className="notice">No tienes permisos para ver esta sección.</div>
  return <>{children}</>
}
