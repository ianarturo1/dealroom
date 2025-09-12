import React, { useEffect } from 'react'
import { identity } from '../lib/identity'

export default function Login(){
  useEffect(() => {
    identity.init()
    identity.open()
  }, [])
  return (
    <div className="container">
      <div className="card">
        <div className="h1">Inicia sesión</div>
        <p>Usa el widget de Netlify Identity para entrar o registrarte por invitación.</p>
        <button className="btn" onClick={() => identity.open()}>Abrir panel de acceso</button>
      </div>
    </div>
  )
}
