import { useId } from "react"
import { STAGES } from "@/lib/stages"
import { Input } from "@/components/ui/Input"
import { FormRow } from "@/components/ui/FormRow"

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
    <div className="grid-2">
      <FormRow label="Etapa">
        <Input
          list={listId}
          value={stage}
          onChange={e => onChange({ ...safeValue, stage: e.target.value })}
          placeholder="Empieza a escribir…"
        />
        <datalist id={listId}>
          {options.map(s => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </FormRow>

      <FormRow label="Fecha">
        <Input
          type="date"
          value={date}
          onChange={e => onChange({ ...safeValue, date: e.target.value })}
        />
      </FormRow>

      {error && (
        <div className="help" style={{ color: "#dc2626", gridColumn: "1 / -1" }}>
          {error}
        </div>
      )}
    </div>
  )
}
