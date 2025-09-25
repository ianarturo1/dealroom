// src/pages/Dashboard.jsx
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ProgressBar from '../components/ProgressBar';
import KPIs from '../components/KPIs';
import useInvestorProfile from '../lib/investor';
import { PIPELINE_STAGES } from '../constants/pipeline';
import { getDecisionDays } from '@/utils/decision';
// Importante: “Días de decisión” es PER INVERSOR (slug). No existe un valor global.

export default function Dashboard() {
  const [investor, setInvestor] = useState(null);
  const [err, setErr] = useState(null);
  const { investorId } = useInvestorProfile();

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    setInvestor(null);

    api.getInvestor(investorId)
      .then(data => { if (!cancelled) setInvestor(data); })
      .catch(error => { if (!cancelled) setErr(error?.message || String(error)); });

    return () => { cancelled = true; };
  }, [investorId]);

  // ------- Derivados -------
  const metrics = investor?.metrics || {};
  const stage = investor?.status ?? '';
  const stageIndex = Math.max(0, PIPELINE_STAGES.findIndex(s => s === stage));
  const nextSteps = stageIndex >= 0 ? PIPELINE_STAGES.slice(stageIndex + 1) : [];
  const deadlines = investor?.deadlines || {};
  const stageLabel = PIPELINE_STAGES[stageIndex] || '—';

  // Días de decisión por inversor (se usará dentro de KPIs → Portafolio)
  const decisionDays = getDecisionDays(investor);

  return (
    <div className="container">
      <div className="h1">Panel</div>
      <p>Visibilidad del roadmap y documentos.</p>

      {/* Avance */}
      <div className="card">
        <div className="h2">Avance</div>
        <ProgressBar stages={PIPELINE_STAGES} current={stage} />
        <div style={{ marginTop: 10, fontSize: 14 }}>
          <strong>Etapa actual:</strong> {stageLabel}
        </div>

        {/* Chips con deadlines (se mantienen) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          {Object.entries(deadlines).map(([k, v]) => (
            <span key={k} className="badge">{k}: {v}</span>
          ))}
        </div>
      </div>

      {/* KPIs (el badge de decisión va dentro del card Portafolio en KPIs) */}
      <div style={{ marginTop: 12 }}>
        <KPIs
          metrics={metrics}
          visibleKeys={['fiscalCapitalInvestment','projectProfitability','portfolio']}
          decisionDays={decisionDays}
        />
      </div>

      {/* Siguientes pasos */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="h2">Siguientes pasos</div>

        {stageIndex < 0 && (
          <p style={{ color: '#8b8b8b', marginBottom: 0 }}>
            No hay pasos siguientes configurados para la etapa actual.
          </p>
        )}

        {stageIndex >= 0 && nextSteps.length === 0 && (
          <p style={{ color: '#8b8b8b', marginBottom: 0 }}>
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

      {err && (
        <div className="card" style={{ marginTop: 12 }}>
          <span className="badge badge-error">{err}</span>
        </div>
      )}
    </div>
  );
}
