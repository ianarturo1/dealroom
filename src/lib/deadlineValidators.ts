import { STAGES } from './stages'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidISODate(s: string) {
  if (!ISO_RE.test(s)) return false
  const d = new Date(s)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function normalize(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
}

/**
 * rows: Array<{ stage: string; date: string }>
 * Valida:
 *  - formato de fecha
 *  - etapas duplicadas
 *  - orden cronológico según STAGES (solo compara etapas presentes)
 */
export function validateRows(rows: Array<{ stage?: string; date?: string }>) {
  // normaliza y arma mapa stage->date con la forma canónica de etapa
  const stageByNorm: Record<string, string> = {}
  STAGES.forEach(s => (stageByNorm[normalize(s)] = s))

  const usedStages = new Set<string>()
  const deadlines: Record<string, string> = {}

  for (const r of rows) {
    const stageInput = r.stage?.trim() || ''
    const date = r.date?.trim() || ''

    if (!stageInput && !date) continue // fila vacía

    // mapear "firma" -> "Firma", ignorando acentos/caso/espacios
    const canonical = stageByNorm[normalize(stageInput)]
    if (!canonical) {
      return { ok: false, message: `Etapa inválida: "${stageInput}". Selecciona una de la lista.` }
    }

    if (!date) {
      return { ok: false, message: `Falta la fecha para "${canonical}".` }
    }

    if (!isValidISODate(date)) {
      return { ok: false, message: `Fecha inválida en "${canonical}". Usa formato YYYY-MM-DD.` }
    }

    if (usedStages.has(canonical)) {
      return { ok: false, message: `La etapa "${canonical}" está repetida.` }
    }
    usedStages.add(canonical)
    deadlines[canonical] = date
  }

  // orden no-decreciente según STAGES
  const present = STAGES.filter(s => deadlines[s])
  for (let i = 0; i < present.length - 1; i++) {
    const a = present[i], b = present[i + 1]
    if (deadlines[a] > deadlines[b]) {
      return {
        ok: false,
        message: `La fecha de "${a}" (${deadlines[a]}) no puede ser posterior a "${b}" (${deadlines[b]}).`
      }
    }
  }

  return { ok: true, deadlines, canonicalStages: Array.from(usedStages) }
}

/** devuelve la siguiente etapa sugerida que aún no está en rows */
export function suggestNextStage(rows: Array<{ stage?: string }>) {
  const current = new Set(
    rows
      .map(r => r.stage || '')
      .map(s => stageByCanonicalOrNull(s))
      .filter(Boolean) as string[]
  )
  for (const s of STAGES) {
    if (!current.has(s)) return s
  }
  return '' // no hay sugerencia
}

function stageByCanonicalOrNull(s: string) {
  const map: Record<string, string> = {}
  STAGES.forEach(x => (map[normalize(x)] = x))
  return map[normalize(s)] || ''
}
