import { useEffect, useMemo, useState } from 'react'
import { DeadlinesRow } from './DeadlinesRow'
import { normalize, suggestNextStage, validateRows } from '@/lib/deadlineValidators'
import { STAGES } from '@/lib/stages'

type Row = { stage?: string; date?: string }

type Props = {
  initial?: Row[]
  onChange?: (rows: Row[]) => void
  onSubmit?: (rows: Row[]) => void | Promise<void>
  showSubmitButton?: boolean
  submitLabel?: string
  submitting?: boolean
  onValidationChange?: (result: ReturnType<typeof validateRows>) => void
}

export function DeadlinesForm({
  initial = [],
  onChange,
  onSubmit,
  showSubmitButton = true,
  submitLabel = 'Guardar',
  submitting = false,
  onValidationChange,
}: Props) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ stage: '', date: '' }])

  useEffect(() => {
    setRows(initial.length ? initial : [{ stage: '', date: '' }])
  }, [initial])

  const canonicalByNorm = useMemo(() => {
    const map: Record<string, string> = {}
    STAGES.forEach(stage => {
      map[normalize(stage)] = stage
    })
    return map
  }, [])

  const validation = useMemo(() => validateRows(rows), [rows])

  useEffect(() => {
    onValidationChange?.(validation)
  }, [validation, onValidationChange])

  const usedCanonical = useMemo(() => {
    const used = new Set<string>()
    rows.forEach(r => {
      const canonical = canonicalByNorm[normalize(r.stage || '')]
      if (canonical) used.add(canonical)
    })
    return used
  }, [rows, canonicalByNorm])

  const availableOptions = useMemo(() => {
    return rows.map(r => {
      const current = canonicalByNorm[normalize(r.stage || '')]
      return STAGES.filter(stage => stage === current || !usedCanonical.has(stage))
    })
  }, [rows, canonicalByNorm, usedCanonical])

  function updateRow(i: number, next: Row) {
    setRows(prev => {
      const copy = prev.slice()
      copy[i] = next
      onChange?.(copy)
      return copy
    })
  }

  function addRow() {
    setRows(prev => {
      const suggestion = suggestNextStage(prev) || ''
      const next = [...prev, { stage: suggestion, date: '' }]
      onChange?.(next)
      return next
    })
  }

  function removeRow(index: number) {
    setRows(prev => {
      if (prev.length <= 1) {
        const fallback = [{ stage: '', date: '' }]
        onChange?.(fallback)
        return fallback
      }
      const next = prev.filter((_, idx) => idx !== index)
      onChange?.(next)
      return next
    })
  }

  function handleSubmit() {
    if (!validation.ok || submitting) return
    onSubmit?.(rows)
  }

  const canSave = validation.ok && !submitting

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.map((r, i) => (
        <DeadlinesRow
          key={i}
          value={r}
          onChange={v => updateRow(i, v)}
          stageOptions={availableOptions[i]}
          onRemove={rows.length > 1 ? () => removeRow(i) : undefined}
          canRemove={rows.length > 1}
        />
      ))}

      {!validation.ok && validation?.message && (
        <div style={{ color: '#b42318', fontSize: 12 }}>{validation.message}</div>
      )}

      <div className="form-row" style={{ gap: 8 }}>
        <button type="button" className="btn secondary" onClick={addRow}>
          Agregar deadline
        </button>

        {showSubmitButton && (
          <button type="button" className="btn" disabled={!canSave} onClick={handleSubmit}>
            {submitting ? 'Guardando…' : submitLabel}
          </button>
        )}
      </div>
    </div>
  )
}
