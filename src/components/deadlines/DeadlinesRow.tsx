import { useId } from "react"
import { STAGES } from "@/lib/stages"

type Props = {
  value?: { stage?: string; date?: string }
  onChange: (v: { stage?: string; date?: string }) => void
  stageOptions?: string[]
  error?: string | null
}

export function DeadlinesRow({ value, onChange, stageOptions, error }: Props) {
  const generatedId = typeof useId === "function" ? useId() : undefined
  const listId = generatedId || "stageOptions"
  const stageInputId = generatedId ? `${generatedId}-stage` : undefined
  const dateInputId = generatedId ? `${generatedId}-date` : undefined
  const safeValue = value ?? {}
  const { stage = "", date = "" } = safeValue
  const options = Array.isArray(stageOptions) && stageOptions.length ? stageOptions : STAGES

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
      <div>
        <label className="label" htmlFor={stageInputId}>Etapa</label>
        <input
          id={stageInputId}
          list={listId}
          className="input"
          value={stage}
          onChange={e => onChange({ ...safeValue, stage: e.target.value })}
          placeholder="Empieza a escribir…"
        />
        <datalist id={listId}>
          {options.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div>
        <label className="label" htmlFor={dateInputId}>Fecha</label>
        <input
          id={dateInputId}
          type="date"
          className="input"
          value={date}
          onChange={e => onChange({ ...safeValue, date: e.target.value })}
        />
      </div>

      {error && (
        <div style={{ gridColumn: "1 / span 2", color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}
    </div>
  )
}
