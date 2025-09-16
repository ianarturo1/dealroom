import React from 'react'

const KPI_DEFINITIONS = [
  { key:'decisionTime', label:'Días a decisión', format: (value) => value ?? '—' },
  { key:'investorsActive', label:'Inversionistas activos', format: (value) => value ?? '—' },
  {
    key: 'dealsAccelerated',
    label: 'Deals acelerados',
    format: (value) =>
      value !== null && value !== undefined
        ? value + '%'
        : '—'
  },
  { key:'nps', label:'NPS', format: (value) => value ?? '—' },
]

export default function KPIs({ metrics = {}, visibleKeys }){
  const allowed = Array.isArray(visibleKeys) && visibleKeys.length
    ? new Set(visibleKeys)
    : null

  const items = KPI_DEFINITIONS
    .filter(def => !allowed || allowed.has(def.key))
    .map(def => ({
      key: def.key,
      label: def.label,
      value: def.format(metrics[def.key])
    }))

  if (!items.length) return null

  return (
    <div className="grid">
      {items.map(it => (
        <div className="card kpi" key={it.key}>
          <div className="num">{it.value}</div>
          <div className="label">{it.label}</div>
        </div>
      ))}
    </div>
  )
}
