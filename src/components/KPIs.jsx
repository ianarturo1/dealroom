import React from 'react'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0
})

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  const num = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(num)) return '—'
  return currencyFormatter.format(num)
}

const formatProjectProfitability = (value) => {
  if (!value || typeof value !== 'object') return '—'
  const amountLabel = formatCurrency(value.amount)
  const parts = []
  if (amountLabel !== '—') parts.push(amountLabel)

  const yearsRaw = value.years
  if (yearsRaw !== null && yearsRaw !== undefined && yearsRaw !== ''){
    const yearsNum = typeof yearsRaw === 'string' ? Number(yearsRaw) : yearsRaw
    const isValidNumber = !Number.isNaN(yearsNum) && yearsNum > 0
    if (isValidNumber){
      parts.push(`a ${yearsNum} ${yearsNum === 1 ? 'año' : 'años'}`)
    }
  }

  return parts.length ? parts.join(' ') : '—'
}

const PORTFOLIO_LABELS = {
  solarFarms: 'Granjas Solares',
  aaaCompanies: 'Empresas AAA',
  ownSites: 'Sitios Propios',
  mix: 'Mix'
}

const formatPortfolio = (value) => {
  if (!value) return '—'
  if (typeof value === 'string') return value

  const type = value.type
  if (!type) return '—'

  if (type === 'mix'){
    const mix = value.mix || {}
    const parts = [
      ['solarFarms', PORTFOLIO_LABELS.solarFarms],
      ['aaaCompanies', PORTFOLIO_LABELS.aaaCompanies],
      ['ownSites', PORTFOLIO_LABELS.ownSites]
    ]
      .map(([key, label]) => {
        const v = mix[key]
        if (v === null || v === undefined || v === '') return null
        return `${v}% ${label}`
      })
      .filter(Boolean)

    if (!parts.length) return 'Mix'
    return `Mix: ${parts.join(' / ')}`
  }

  return PORTFOLIO_LABELS[type] || type
}

const KPI_DEFINITIONS = [
  { key:'decisionTime', label:'Días a decisión', format: (value) => value ?? '—' },
  {
    key: 'fiscalCapitalInvestment',
    label: 'Inversión de capital fiscal',
    format: formatCurrency
  },
  {
    key: 'projectProfitability',
    label: 'Utilidad de proyecto',
    format: formatProjectProfitability
  },
  {
    key: 'portfolio',
    label: 'Portafolio',
    format: formatPortfolio
  },
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
          <div className="label">{it.label}</div>
          <div className="num">{it.value}</div>
        </div>
      ))}
    </div>
  )
}
