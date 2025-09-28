import { useId } from "react";
import { STAGES } from "@/lib/stages";

type Props = {
  value: { stage?: string; date?: string };
  onChange: (v: { stage?: string; date?: string }) => void;
  stageOptions?: string[]; // para ocultar etapas ya usadas
  error?: string | null;
};

export function DeadlinesRow({ value, onChange, stageOptions, error }: Props) {
  const listId = useId();
  const { stage = "", date = "" } = value || {};
  const options = stageOptions && stageOptions.length ? stageOptions : STAGES;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm mb-1">Etapa</label>
        <input
          list={listId}
          className="w-full border rounded p-2"
          value={stage}
          onChange={e => onChange({ ...value, stage: e.target.value })}
          placeholder="Empieza a escribir…"
        />
        <datalist id={listId}>
          {options.map(s => <option key={s} value={s} />)}
        </datalist>
      </div>

      <div>
        <label className="block text-sm mb-1">Fecha</label>
        <input
          type="date"
          className="w-full border rounded p-2"
          value={date}
          onChange={e => onChange({ ...value, date: e.target.value })}
        />
      </div>

      {error && <div className="col-span-2 text-red-600 text-sm mt-1">{error}</div>}
    </div>
  );
}
