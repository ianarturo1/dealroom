const DEADLINE_DOC_RULES = [
  { pattern: /(firma|contrato)/i, category: 'Contratos' },
  { pattern: /loi/i, category: 'LOIs' },
  { pattern: /nda/i, category: 'NDA' },
  { pattern: /propuesta/i, category: 'Propuestas' }
]

export const DEADLINE_DOC_CATEGORIES = Array.from(new Set(DEADLINE_DOC_RULES.map(rule => rule.category)))

export function resolveDeadlineDocTarget(label){
  const text = typeof label === 'string' ? label : String(label || '')
  if (!text.trim()) return null
  const normalized = text.toLowerCase()
  for (const rule of DEADLINE_DOC_RULES){
    if (rule.pattern.test(normalized)){
      return {
        category: rule.category,
        target: 'upload'
      }
    }
  }
  return null
}
