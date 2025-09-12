import React, { useState } from 'react'
import { api } from '../lib/api'
import RoleGate from '../components/RoleGate'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

export default function Admin({ user }){
  const [payload, setPayload] = useState({
    id: 'femsa',
    name: 'FEMSA',
    status: 'LOI',
    deadlines: { 'LOI':'2025-10-15', 'Firma':'2025-11-30' },
    metrics: { decisionTime: 35, investorsActive: 12, dealsAccelerated: 38, nps: 72 }
  })
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    try{
      await api.updateStatus(payload)
      setMsg('Guardado y commiteado a GitHub.')
    }catch(error){ setErr(error.message) }
  }

  return (
    <RoleGate user={user} allow={['admin','ri']}>
      <div className="container">
        <div className="h1">Admin / Relaciones con Inversionistas</div>
        <div className="card">
          <div className="h2">Actualizar estado de inversionista</div>
          <form onSubmit={onSubmit} className="form-row">
            <input className="input" placeholder="slug (id)" value={payload.id} onChange={e => setPayload({...payload, id:e.target.value})} />
            <input className="input" placeholder="Nombre" value={payload.name} onChange={e => setPayload({...payload, name:e.target.value})} />
            <select className="select" value={payload.status} onChange={e => setPayload({...payload, status:e.target.value})}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
            <button className="btn" type="submit">Guardar</button>
          </form>
          {msg && <div className="notice" style={{marginTop:8}}>{msg}</div>}
          {err && <div className="notice" style={{marginTop:8}}>{err}</div>}
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="h2">Notas</div>
          <ul>
            <li>Este panel hace commits a GitHub (mismo repo) en <code>data/investors/&lt;slug&gt;.json</code>.</li>
            <li>Netlify vuelve a construir el sitio y los cambios quedan visibles al instante.</li>
          </ul>
        </div>
      </div>
    </RoleGate>
  )
}
