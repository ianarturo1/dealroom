// src/utils/decision.js
import { daysFromTodayTo } from './dates.js'

// Sinónimos aceptados para "Firma"
const FIRMA_KEYS = new Set([
  'firma',
  'firma de contratos',
  'firma contratos',
  'firma de contrato',
])

// 🔒 Días de decisión: SOLO con la deadline "Firma" (o sinónimos).
export function getDecisionDays(investor) {
  const dl = investor?.deadlines
  if (!dl || typeof dl !== 'object') return null

  // Normalizar claves a minúsculas y valores a string recortado
  const entries = Object.entries(dl).map(([key, value]) => [
    String(key).trim().toLowerCase(),
    typeof value === 'string' ? value.trim() : value,
  ])

  // Buscar "Firma" / sinónimos
  const firmaEntry = entries.find(([key]) => FIRMA_KEYS.has(key))
  if (!firmaEntry) return null

  const [, firmaDate] = firmaEntry
  const diff = daysFromTodayTo(firmaDate)
  return diff === null ? null : diff
}

// Helper para pintar el badge en UI
export function getDecisionBadge(decisionDays) {
  if (decisionDays == null) {
    return { className: 'badge', label: 'Sin fecha configurada' }
  }

  if (decisionDays < 0) {
    return {
      className: 'badge badge-error',
      label: `Vencido hace ${Math.abs(decisionDays)} días`,
    }
  }

  if (decisionDays === 0) {
    return {
      className: 'badge badge-warning',
      label: 'Día de decisión: Hoy',
    }
  }

  const label = `Días para decidir: ${decisionDays}`
  const className = decisionDays <= 7 ? 'badge badge-warning' : 'badge badge-success'
  return { className, label }
}
