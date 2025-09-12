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

  const [inv, setInv] = useState({ email: '', companyName: '', slug: '', status: 'NDA', deadlines: [{ k: '', v: '' }, { k: '', v: '' }] })
  const [invMsg, setInvMsg] = useState(null)
  const [invErr, setInvErr] = useState(null)
  const [invLoading, setInvLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    try{
      await api.updateStatus(payload)
      setMsg('Guardado y commiteado a GitHub.')
    }catch(error){ setErr(error.message) }
  }

  const setDeadline = (i, field, value) => {
    const arr = [...inv.deadlines]
    arr[i] = { ...arr[i], [field]: value }
    setInv({ ...inv, deadlines: arr })
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setInvMsg(null); setInvErr(null)
    setInvLoading(true); setProgress(10)
    try{
      const dl = {}
      for (const d of inv.deadlines){ if (d.k && d.v) dl[d.k] = d.v }
      const payload = { email: inv.email, companyName: inv.companyName, status: inv.status, deadlines: dl }
      if (inv.slug) payload.slug = inv.slug
      const res = await api.createInvestor(payload)
      setProgress(100)
      setInvMsg(res)
    }catch(error){ setInvErr(error.message); setProgress(0) }
    finally{ setInvLoading(false) }
  }

  return (
    <RoleGate user={user} allow={['admin','ri']}>
      <div className="container">
        <div className="h1">Admin / Relaciones con Inversionistas</div>
        <div className="card" style={{marginBottom:12}}>
          <div className="h2">Alta de Inversionista</div>
          <form onSubmit={onCreate}>
            <div className="form-row">
              <input className="input" type="email" placeholder="Email corporativo" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} required />
              <input className="input" placeholder="Nombre de la empresa" value={inv.companyName} onChange={e => setInv({ ...inv, companyName: e.target.value })} required />
              <input className="input" placeholder="Slug deseado (opcional)" value={inv.slug} onChange={e => setInv({ ...inv, slug: e.target.value })} />
              <select className="select" value={inv.status} onChange={e => setInv({ ...inv, status: e.target.value })}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginTop:8}}>
              {inv.deadlines.map((d, i) => (
                <div key={i} className="form-row" style={{marginTop:4}}>
                  <input className="input" placeholder="Clave" value={d.k} onChange={e => setDeadline(i, 'k', e.target.value)} />
                  <input className="input" type="date" value={d.v} onChange={e => setDeadline(i, 'v', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{marginTop:4}} onClick={() => setInv({ ...inv, deadlines: [...inv.deadlines, { k: '', v: '' }] })}>Agregar deadline</button>
            </div>
            <button className="btn" type="submit" disabled={invLoading} style={{marginTop:8}}>Crear</button>
          </form>
          {invLoading && <div className="progress" style={{marginTop:8}}><div style={{width: progress + '%'}} /></div>}
          {invMsg && <div className="notice" style={{marginTop:8}}><pre style={{margin:0}}>{JSON.stringify(invMsg, null, 2)}</pre></div>}
          {invErr && <div className="notice" style={{marginTop:8}}>{invErr}</div>}
        </div>
        <div className="card">
          <div className="h2">Actualizar estado de inversionista</div>
          <form onSubmit={onSubmit} className="form-row">
            <input className="input" placeholder="slug (id)" value={payload.id} onChange={e => setPayload({ ...payload, id: e.target.value })} />
            <input className="input" placeholder="Nombre" value={payload.name} onChange={e => setPayload({ ...payload, name: e.target.value })} />
            <select className="select" value={payload.status} onChange={e => setPayload({ ...payload, status: e.target.value })}>
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
