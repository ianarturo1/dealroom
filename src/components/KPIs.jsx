import React from 'react'

export default function KPIs({ metrics = {} }){
  const items = [
    { key:'decisionTime', label:'Días a decisión', value: metrics.decisionTime ?? '—' },
    { key:'investorsActive', label:'Inversionistas activos', value: metrics.investorsActive ?? '—' },
    { key:'dealsAccelerated', label:'Deals acelerados', value: metrics.dealsAccelerated ? (metrics.dealsAccelerated+'%') : '—' },
    { key:'nps', label:'NPS', value: metrics.nps ?? '—' },
  ]
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
