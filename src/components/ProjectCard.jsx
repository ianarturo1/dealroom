import React from 'react'

export default function ProjectCard({ p }){
  const investorId = (p.id || '').trim().toLowerCase()
  const documentsHref = investorId
    ? `/#/documents?investor=${encodeURIComponent(investorId)}`
    : '#/documents'

  const metaParts = [p.client, p.location].filter(Boolean)
  const formatMetric = (value, unit) => {
    if (value === null || value === undefined || value === '') {
      return '—'
    }
    return unit ? `${value} ${unit}` : value
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="h2">{p.name}</div>
        <span className="badge">{p.status || 'Disponible'}</span>
      </div>
      {metaParts.length > 0 && (
        <div style={{color:'#8b8b8b', marginBottom:8}}>{metaParts.join(' • ')}</div>
      )}
      <table className="table">
        <tbody>
          <tr><th>Potencia</th><td>{formatMetric(p.power_kwp, 'kWp')}</td></tr>
          <tr><th>Energía anual</th><td>{formatMetric(p.energy_mwh, 'MWh')}</td></tr>
          <tr><th>CO₂ evitado</th><td>{formatMetric(p.co2_tons, 't/año')}</td></tr>
        </tbody>
      </table>
      {p.notes && <div className="notice" style={{marginTop:10}}>{p.notes}</div>}
      <div style={{display:'flex', gap:8, marginTop:12}}>
        {p.loi_template && <a className="btn secondary" href={p.loi_template} target="_blank" rel="noreferrer">Descargar LOI</a>}
        <a className="btn" href={documentsHref}>Ver documentos</a>
      </div>
    </div>
  )
}
