import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import ProgressBar from '../components/ProgressBar'
import KPIs from '../components/KPIs'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

export default function Dashboard(){
  const [investor, setInvestor] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    api.getInvestor().then(setInvestor).catch(e => setErr(e.message))
  }, [])

  const metrics = investor?.metrics || { decisionTime: '—', investorsActive: '—', dealsAccelerated: 0, nps: '—' }
  const stage = investor?.status || STAGES[0]
  const deadlines = investor?.deadlines || {}

  return (
    <div className="container">
      <div className="row">
        <div>
          <div className="h1">Panel</div>
          <div style={{color:'#8b8b8b'}}>Visibilidad del roadmap y documentos.</div>
        </div>
      </div>

      {err && <div className="notice">{err}</div>}

      <div className="card">
        <div className="h2">Avance</div>
        <ProgressBar stages={STAGES} current={stage} />
        <div style={{marginTop:10, fontSize:14}}>
          <strong>Etapa actual:</strong> {stage}
        </div>
        <div style={{display:'flex', flexWrap:'wrap', gap:12, marginTop:8}}>
          {Object.entries(deadlines).map(([k,v]) => (
            <span key={k} className="badge">{k}: {v}</span>
          ))}
        </div>
      </div>

      <div style={{marginTop:12}}>
        <KPIs metrics={metrics} />
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="h2">Siguientes pasos</div>
        <ol>
          <li>Completar NDA y carpeta de información.</li>
          <li>Revisar propuesta técnica-financiera y confirmar alcance.</li>
          <li>Emitir LOI con montos y plazos.</li>
          <li>Iniciar due diligence y revisión de contratos.</li>
          <li>Definir cronograma de inversión y firmar.</li>
        </ol>
      </div>
    </div>
  )
}
