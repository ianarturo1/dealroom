import { useMemo, useState } from "react"
import { DeadlinesRow } from "./DeadlinesRow"
import { validateRows, suggestNextStage } from "@/lib/deadlineValidators"
import { STAGES } from "@/lib/stages"
import { Button } from "@/components/ui/Button"
import { Toolbar } from "@/components/ui/Toolbar"

type Row = { stage?: string; date?: string }

type Props = {
  initial?: Row[]
  onChange?: (rows: Row[]) => void
  onSubmit?: (rows: Row[]) => void
  saving?: boolean
  hideSubmit?: boolean
  saveLabel?: string
}

export function DeadlinesForm({ initial = [], onChange, onSubmit, saving = false, hideSubmit = false, saveLabel = "Guardar" }: Props) {
  const safeInitial = Array.isArray(initial) && initial.length ? initial : [{ stage: "", date: "" }]
  const [rows, setRows] = useState<Row[]>(safeInitial)

  const { validation, availableOptions } = useMemo(() => {
    try {
      const safeRows = Array.isArray(rows) ? rows : []
      const v = validateRows(safeRows)
      const used = new Set<string>()
      safeRows.forEach(r => {
        const s = r?.stage?.trim()
        if (s) used.add(s)
      })

      const options = safeRows.map(r => {
        if (!r?.stage) {
          return STAGES.filter(stage => !used.has(stage))
        }
        return STAGES
      })

      return {
        validation: v,
        availableOptions: options.length ? options : safeRows.map(() => STAGES),
      }
    } catch (e) {
      console.error("DeadlinesForm memo error:", e)
      const fallbackRows = Array.isArray(rows) ? rows : []
      return {
        validation: { ok: false, message: "Error interno." },
        availableOptions: fallbackRows.map(() => STAGES),
      }
    }
  }, [rows])

  function updateRow(i: number, next: Row) {
    setRows(prev => {
      const base = Array.isArray(prev) ? prev.slice() : []
      base[i] = next ?? { stage: "", date: "" }
      onChange?.(base)
      return base
    })
  }

  function addRow() {
    setRows(prev => {
      const safeRows = Array.isArray(prev) ? prev : []
      const suggestion = suggestNextStage(safeRows) || ""
      const nextRows = [...safeRows, { stage: suggestion, date: "" }]
      onChange?.(nextRows)
      return nextRows
    })
  }

  const canSave = Boolean(validation?.ok) && !saving

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(Array.isArray(rows) ? rows : []).map((r, i) => (
        <DeadlinesRow
          key={i}
          value={r}
          onChange={v => updateRow(i, v)}
          stageOptions={availableOptions[i]}
        />
      ))}

      {!canSave && validation?.message && (
        <div className="help" style={{ color: "#dc2626" }}>{validation.message}</div>
      )}

      <Toolbar>
        <Button type="button" variant="secondary" onClick={addRow} disabled={saving}>
          Agregar deadline
        </Button>

        {!hideSubmit && (
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return
              const currentRows = Array.isArray(rows) ? rows : []
              if (!Array.isArray(currentRows)) return
              onSubmit?.(currentRows)
            }}
          >
            {saving ? "Guardando…" : saveLabel}
          </Button>
        )}
      </Toolbar>
    </div>
  )
}
