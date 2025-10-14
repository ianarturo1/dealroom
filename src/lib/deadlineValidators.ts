import { STAGES } from "@/lib/stages"

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function isValidISODate(s: string) {
  if (!ISO_RE.test(s)) return false
  const d = new Date(s)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function normalize(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

/**
 * Filas sin fecha NO bloquean el guardado; se ignoran.
 * Si hay fecha, valida formato, etapa válida, duplicados y orden (cuando aplique).
 */
export function validateRows(rows: Array<{ stage?: string; date?: string }> = []) {
  try {
    const safeRows = Array.isArray(rows) ? rows : []

    const stageByNorm: Record<string, string> = {}
    STAGES.forEach(s => (stageByNorm[normalize(s)] = s))

    const usedStages = new Set<string>()
    const deadlines: Record<string, string> = {}

    for (const r of safeRows) {
      const stageInput = (r?.stage || "").trim()
      const date = (r?.date || "").trim()

      if (!stageInput && !date) continue

      const canonical = stageByNorm[normalize(stageInput)]
      if (stageInput && !canonical) {
        return { ok: false, message: `Etapa inválida: "${stageInput}". Selecciona una de la lista.` }
      }

      if (!date) continue

      if (!canonical) {
        return { ok: false, message: `Etapa inválida: "${stageInput}". Selecciona una de la lista.` }
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

    const seq = STAGES
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const a = seq[i], b = seq[j]
        if (deadlines[a] && deadlines[b] && deadlines[a] > deadlines[b]) {
          return { ok: false, message: `La fecha de "${a}" (${deadlines[a]}) no puede ser posterior a "${b}" (${deadlines[b]}).` }
        }
      }
    }

    return { ok: true, deadlines, canonicalStages: Array.from(usedStages) }
  } catch (err) {
    console.error("validateRows error:", err)
    return { ok: false, message: "Error validando deadlines." }
  }
}

export function suggestNextStage(rows: Array<{ stage?: string }> = []) {
  const current = new Set(
    (Array.isArray(rows) ? rows : [])
      .map(r => r?.stage || "")
      .map(s => stageByCanonicalOrNull(s))
      .filter(Boolean) as string[]
  )
  for (const s of STAGES) if (!current.has(s)) return s
  return ""
}

function stageByCanonicalOrNull(s: string) {
  const map: Record<string, string> = {}
  STAGES.forEach(x => (map[normalize(x)] = x))
  return map[normalize(s)] || ""
}
