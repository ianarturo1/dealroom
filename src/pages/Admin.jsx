import React, { useState } from 'react'
import { api } from '../lib/api'
import RoleGate from '../components/RoleGate'
import { DEFAULT_INVESTOR_ID } from '../lib/config'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

const PORTFOLIO_OPTIONS = [
  { value: 'solarFarms', label: 'Granjas Solares' },
  { value: 'aaaCompanies', label: 'Empresas AAA' },
  { value: 'ownSites', label: 'Sitios Propios' },
  { value: 'mix', label: 'Mix' }
]

const MIX_FIELDS = [
  { key: 'solarFarms', label: 'Granjas Solares' },
  { key: 'aaaCompanies', label: 'Empresas AAA' },
  { key: 'ownSites', label: 'Sitios Propios' }
]

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

export default function Admin({ user }){
  const defaultName = DEFAULT_INVESTOR_ID === 'femsa'
    ? 'FEMSA'
    : DEFAULT_INVESTOR_ID.toUpperCase()
  const [payload, setPayload] = useState({
    id: DEFAULT_INVESTOR_ID,
    name: defaultName,
    status: 'LOI',
    deadlines: { 'LOI':'2025-10-15', 'Firma':'2025-11-30' },
    metrics: {
      decisionTime: 35,
      fiscalCapitalInvestment: 20000000,
      projectProfitability: { amount: 12500000, years: 7 },
      portfolio: {
        type: 'mix',
        mix: { solarFarms: 40, aaaCompanies: 35, ownSites: 25 }
      },
      investorsActive: 12,
      dealsAccelerated: 38,
      nps: 72
    }
  })
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const [inv, setInv] = useState({ email: '', companyName: '', slug: '', status: 'NDA', deadlines: [{ k: '', v: '' }, { k: '', v: '' }] })
  const [invMsg, setInvMsg] = useState(null)
  const [invErr, setInvErr] = useState(null)
  const [invLoading, setInvLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const metrics = payload.metrics || {}

  const updateMetric = (key, updater) => {
    setPayload(prev => {
      const prevMetrics = prev.metrics || {}
      const nextValue = typeof updater === 'function'
        ? updater(prevMetrics[key])
        : updater
      return { ...prev, metrics: { ...prevMetrics, [key]: nextValue } }
    })
  }

  const handlePortfolioTypeChange = (type) => {
    updateMetric('portfolio', current => {
      const next = { type }
      if (type === 'mix'){
        const prevMix = current && current.type === 'mix' && current.mix ? current.mix : {}
        next.mix = {
          solarFarms: prevMix.solarFarms ?? '',
          aaaCompanies: prevMix.aaaCompanies ?? '',
          ownSites: prevMix.ownSites ?? ''
        }
      }
      return next
    })
  }

  const handleMixChange = (field, value) => {
    updateMetric('portfolio', current => {
      const base = current && current.type === 'mix'
        ? current
        : { type: 'mix', mix: { solarFarms: '', aaaCompanies: '', ownSites: '' } }
      return {
        ...base,
        mix: {
          ...(base.mix || {}),
          [field]: value
        }
      }
    })
  }

  const portfolio = metrics.portfolio || {}
  const isPortfolioMix = portfolio.type === 'mix'
  const mixValues = isPortfolioMix
    ? {
        solarFarms: portfolio.mix?.solarFarms ?? '',
        aaaCompanies: portfolio.mix?.aaaCompanies ?? '',
        ownSites: portfolio.mix?.ownSites ?? ''
      }
    : { solarFarms: '', aaaCompanies: '', ownSites: '' }
  const mixTotal = isPortfolioMix
    ? MIX_FIELDS.reduce((sum, field) => {
        const raw = mixValues[field.key]
        const num = Number(raw)
        return sum + (Number.isNaN(num) ? 0 : num)
      }, 0)
    : 0
  const projectProfitability = metrics.projectProfitability || {}

  const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }
  const fieldStyle = { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 200 }
  const mixFieldStyle = { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 160 }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    try{
      const metricsPayload = payload.metrics || {}
      const normalizedMetrics = {
        ...metricsPayload,
        decisionTime: parseNumber(metricsPayload.decisionTime),
        fiscalCapitalInvestment: parseNumber(metricsPayload.fiscalCapitalInvestment)
      }

      if (metricsPayload.investorsActive !== undefined){
        normalizedMetrics.investorsActive = parseNumber(metricsPayload.investorsActive)
      }
      if (metricsPayload.dealsAccelerated !== undefined){
        normalizedMetrics.dealsAccelerated = parseNumber(metricsPayload.dealsAccelerated)
      }
      if (metricsPayload.nps !== undefined){
        normalizedMetrics.nps = parseNumber(metricsPayload.nps)
      }

      const profitRaw = metricsPayload.projectProfitability || {}
      const profitAmount = parseNumber(profitRaw.amount)
      const profitYears = parseNumber(profitRaw.years)
      normalizedMetrics.projectProfitability = (profitAmount === null && profitYears === null)
        ? null
        : { amount: profitAmount, years: profitYears }

      const portfolioRaw = metricsPayload.portfolio
      if (!portfolioRaw || !portfolioRaw.type){
        normalizedMetrics.portfolio = null
      }else if (portfolioRaw.type === 'mix'){
        const mixRaw = portfolioRaw.mix || {}
        const normalizedMix = MIX_FIELDS.reduce((acc, field) => {
          const parsed = parseNumber(mixRaw[field.key])
          if (parsed !== null){
            acc[field.key] = parsed
          }
          return acc
        }, {})
        normalizedMetrics.portfolio = { type: 'mix', mix: normalizedMix }
      }else{
        normalizedMetrics.portfolio = { type: portfolioRaw.type }
      }

      const payloadToSend = { ...payload, metrics: normalizedMetrics }
      await api.updateStatus(payloadToSend)
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
      setInvMsg(res.link)
      try{ await navigator.clipboard.writeText(res.link) }catch{}
    }catch(error){ setInvErr(`Error al crear inversionista: ${error.message}`); setProgress(0) }
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
          {invMsg && (
            <div className="notice" style={{marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{wordBreak:'break-all'}}>{invMsg}</span>
              <button className="btn" type="button" onClick={() => navigator.clipboard && navigator.clipboard.writeText(invMsg)}>Copiar</button>
            </div>
          )}
          {invErr && <div className="notice" style={{marginTop:8}}>{invErr}</div>}
        </div>
        <div className="card">
          <div className="h2">Actualizar estado de inversionista</div>
          <form onSubmit={onSubmit}>
            <div className="form-row">
              <input
                className="input"
                placeholder="slug (id)"
                value={payload.id}
                onChange={e => setPayload({ ...payload, id: e.target.value })}
              />
              <input
                className="input"
                placeholder="Nombre"
                value={payload.name}
                onChange={e => setPayload({ ...payload, name: e.target.value })}
              />
              <select
                className="select"
                value={payload.status}
                onChange={e => setPayload({ ...payload, status: e.target.value })}
              >
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 12, fontWeight: 700 }}>Métricas clave</div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-decisionTime" style={labelStyle}>Días a decisión</label>
                <input
                  id="metric-decisionTime"
                  className="input"
                  type="number"
                  min="0"
                  value={metrics.decisionTime ?? ''}
                  onChange={e => updateMetric('decisionTime', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="metric-fiscal" style={labelStyle}>Inversión de capital fiscal ($)</label>
                <input
                  id="metric-fiscal"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={metrics.fiscalCapitalInvestment ?? ''}
                  onChange={e => updateMetric('fiscalCapitalInvestment', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-project-amount" style={labelStyle}>Utilidad de proyecto ($)</label>
                <input
                  id="metric-project-amount"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={projectProfitability.amount ?? ''}
                  onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), amount: e.target.value }))}
                />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="metric-project-years" style={labelStyle}>Horizonte (años)</label>
                <input
                  id="metric-project-years"
                  className="input"
                  type="number"
                  min="0"
                  value={projectProfitability.years ?? ''}
                  onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), years: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-portfolio-type" style={labelStyle}>Portafolio</label>
                <select
                  id="metric-portfolio-type"
                  className="select"
                  value={portfolio.type || ''}
                  onChange={e => handlePortfolioTypeChange(e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  {PORTFOLIO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isPortfolioMix && (
              <div style={{ marginTop: 8 }}>
                <div className="form-row">
                  {MIX_FIELDS.map(field => (
                    <div key={field.key} style={mixFieldStyle}>
                      <label htmlFor={`metric-portfolio-${field.key}`} style={labelStyle}>{field.label} (%)</label>
                      <input
                        id={`metric-portfolio-${field.key}`}
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={mixValues[field.key] ?? ''}
                        onChange={e => handleMixChange(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>Suma: {mixTotal}%</div>
              </div>
            )}

            <button className="btn" type="submit" style={{ marginTop: 12 }}>Guardar</button>
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
