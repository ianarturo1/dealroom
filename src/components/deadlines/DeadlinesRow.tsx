import { Fragment, useId } from "react"
import { STAGES } from "@/lib/stages"
import { Field } from "@/components/ui/Field"

type Props = {
  value?: { stage?: string; date?: string }
  onChange: (v: { stage?: string; date?: string }) => void
  stageOptions?: string[]
  error?: string | null
}

export function DeadlinesRow({ value, onChange, stageOptions, error }: Props) {
  const generatedId = typeof useId === "function" ? useId() : undefined
  const listId = generatedId || "stageOptions"
  const safeValue = value ?? {}
  const { stage = "", date = "" } = safeValue
  const options = Array.isArray(stageOptions) && stageOptions.length ? stageOptions : STAGES

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      }}
    >
      <Field label="Etapa">
        <Fragment>
          <input
            list={listId}
            className="input"
            value={stage}
            onChange={e => onChange({ ...safeValue, stage: e.target.value })}
            placeholder="Empieza a escribir…"
          />
          <datalist id={listId}>
            {options.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Fragment>
      </Field>

      <Field label="Fecha">
        <input
          type="date"
          className="input"
          value={date}
          onChange={e => onChange({ ...safeValue, date: e.target.value })}
        />
      </Field>

      {error && (
        <div style={{ gridColumn: "1 / -1", color: "#b42318", fontSize: 13 }}>{error}</div>
      )}
    </div>
  )
}
