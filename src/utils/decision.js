import { daysFromTodayTo } from './dates.js'

export function getDecisionDays(investor){
  const firma = investor?.deadlines?.Firma || investor?.deadlines?.['Firma de contratos']
  const diff = daysFromTodayTo(firma)
  if (diff !== null) return diff

  const dl = investor?.deadlines || {}
  const values = Object.values(dl).filter(Boolean)
  const candidates = values
    .map(d => ({ d, diff: daysFromTodayTo(d) }))
    .filter(x => x.diff !== null)
    .sort((a, b) => a.diff - b.diff)

  const upcoming = candidates.find(item => item.diff >= 0)
  if (upcoming) return upcoming.diff

  return candidates.length ? candidates[candidates.length - 1].diff : null
}

export function getDecisionBadge(decisionDays){
  if (decisionDays == null){
    return { className: 'badge', label: 'Sin fecha configurada' }
  }

  if (decisionDays < 0){
    return {
      className: 'badge badge-error',
      label: `Vencido hace ${Math.abs(decisionDays)} días`
    }
  }

  if (decisionDays === 0){
    return {
      className: 'badge badge-warning',
      label: 'Día de decisión: Hoy'
    }
  }

  const label = `Días para decidir: ${decisionDays}`
  const className = decisionDays <= 7 ? 'badge badge-warning' : 'badge badge-success'

  return { className, label }
}
