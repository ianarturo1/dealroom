import { type CSSProperties, useId } from 'react'
import { STAGES } from '@/lib/stages'

type Props = {
  value: { stage?: string; date?: string }
  onChange: (v: { stage?: string; date?: string }) => void
  stageOptions?: string[]
  error?: string | null
  onRemove?: () => void
  canRemove?: boolean
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 200,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--muted)',
  marginBottom: 4,
}

export function DeadlinesRow({ value, onChange, stageOptions, error, onRemove, canRemove }: Props) {
  const { stage = '', date = '' } = value || {}
  const options = stageOptions && stageOptions.length ? stageOptions : STAGES
  const listId = useId()

  return (
    <div style={{ width: '100%' }}>
      <div className="form-row" style={{ alignItems: 'flex-end' }}>
        <div style={fieldStyle}>
          <label htmlFor={`${listId}-stage`} style={labelStyle}>
            Etapa
          </label>
          <input
            id={`${listId}-stage`}
            list={listId}
            className="input"
            value={stage}
            onChange={e => onChange({ ...value, stage: e.target.value })}
            placeholder="Empieza a escribir…"
          />
          <datalist id={listId}>
            {options.map(s => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div style={fieldStyle}>
          <label htmlFor={`${listId}-date`} style={labelStyle}>
            Fecha
          </label>
          <input
            id={`${listId}-date`}
            type="date"
            className="input"
            value={date}
            onChange={e => onChange({ ...value, date: e.target.value })}
          />
        </div>
        {canRemove && onRemove && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button type="button" className="btn secondary" onClick={onRemove}>
              Eliminar
            </button>
          </div>
        )}
      </div>
      {error && <div style={{ color: '#b42318', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  )
}
