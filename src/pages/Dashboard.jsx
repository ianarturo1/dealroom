import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import ProgressBar from '../components/ProgressBar'
import KPIs from '../components/KPIs'
import { useInvestorProfile } from '../lib/investor'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

export default function Dashboard(){
  const [investor, setInvestor] = useState(null)
  const [err, setErr] = useState(null)
  const { investorId } = useInvestorProfile()

  useEffect(() => {
    let cancelled = false
    setErr(null)
    setInvestor(null)
    api.getInvestor(investorId)
      .then(data => {
        if (!cancelled) setInvestor(data)
      })
      .catch(error => {
        if (!cancelled){
          setErr(error.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [investorId])

  const metrics = investor?.metrics || {}
  const stage = investor?.status ?? ''
  const stageIndex = stage ? STAGES.findIndex(s => s === stage) : -1
  const nextSteps = stageIndex >= 0 ? STAGES.slice(stageIndex + 1) : []
  const deadlines = investor?.deadlines || {}
  const stageLabel = stage || '—'

  return (
    <div className="container">
      <div className="row">
        <div>
          <div className="h1">Panel</div>
          <p className="page-subtitle">Visibilidad del roadmap y documentos.</p>
        </div>
      </div>

      {err && <div className="notice">{err}</div>}

      <div className="card">
        <div className="h2">Avance</div>
        <ProgressBar stages={STAGES} current={stage} />
        <div className="progress-meta">
          <strong>Etapa actual:</strong> {stageLabel}
        </div>
        <div className="badge-group">
          {Object.entries(deadlines).map(([k,v]) => (
            <span key={k} className="badge">{k}: {v}</span>
          ))}
        </div>
      </div>

      <div className="section-spacer">
        <KPIs
          metrics={metrics}
          visibleKeys={['decisionTime','fiscalCapitalInvestment','projectProfitability','portfolio']}
        />
      </div>

      <div className="card section-spacer">
        <div className="h2">Siguientes pasos</div>
        {stage && stageIndex < 0 && (
          <p className="muted no-margin">
            No hay pasos siguientes configurados para la etapa actual.
          </p>
        )}
        {stageIndex >= 0 && nextSteps.length === 0 && (
          <p className="muted no-margin">
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
