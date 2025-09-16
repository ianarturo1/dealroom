import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import ProgressBar from '../components/ProgressBar'
import KPIs from '../components/KPIs'
import { DEFAULT_INVESTOR_ID } from '../lib/config'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

export default function Dashboard(){
  const [investor, setInvestor] = useState(null)
  const [err, setErr] = useState(null)
  const [searchParams] = useSearchParams()
  const searchSlug = searchParams.get('investor')
  const investorId = (searchSlug && searchSlug.trim().toLowerCase()) || DEFAULT_INVESTOR_ID

  useEffect(() => {
    api.getInvestor(investorId).then(setInvestor).catch(e => setErr(e.message))
  }, [investorId])

  const metrics = investor?.metrics || {}
  const stage = investor?.status || STAGES[0]
  const stageIndex = STAGES.findIndex(s => s === stage)
  const nextSteps = stageIndex >= 0 ? STAGES.slice(stageIndex + 1) : []
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
        <KPIs
          metrics={metrics}
          visibleKeys={['decisionTime','fiscalCapitalInvestment','projectProfitability','portfolio']}
        />
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="h2">Siguientes pasos</div>
        {stageIndex < 0 && (
          <p style={{color:'#8b8b8b', marginBottom:0}}>
            No hay pasos siguientes configurados para la etapa actual.
          </p>
        )}
        {stageIndex >= 0 && nextSteps.length === 0 && (
          <p style={{color:'#8b8b8b', marginBottom:0}}>
            Has completado todas las etapas del proceso.
          </p>
        )}
        {nextSteps.length > 0 && (
          <ol>
            {nextSteps.map(step => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
