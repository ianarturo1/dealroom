import { useMemo, useState } from "react";
import { DeadlinesRow } from "./DeadlinesRow";
import { validateRows, suggestNextStage } from "@/lib/deadlineValidators";
import { STAGES } from "@/lib/stages";

type Row = { stage?: string; date?: string };

type Props = {
  initial?: Row[]; // [{stage, date}] opcional
  onChange?: (rows: Row[]) => void;
  onSubmit?: (rows: Row[]) => void;
  saving?: boolean;
  hideSubmit?: boolean;
  saveLabel?: string;
};

export function DeadlinesForm({ initial = [], onChange, onSubmit, saving = false, hideSubmit = false, saveLabel = "Guardar" }: Props) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ stage: "", date: "" }]);

  const { validation, availableOptions } = useMemo(() => {
    const v = validateRows(rows);
    const used = new Set<string>();
    rows.forEach(r => {
      const s = r.stage?.trim();
      if (s) used.add(s);
    });
    // opciones por fila: ocultar ya usadas (solo si la fila aún no eligió etapa)
    const options = rows.map(r => {
      if (!r.stage) return STAGES.filter(s => !Array.from(used).includes(s));
      return STAGES;
    });
    return {
      validation: v,
      availableOptions: options,
    };
  }, [rows]);

  function updateRow(i: number, next: Row) {
    const copy = rows.slice();
    copy[i] = next;
    setRows(copy);
    onChange?.(copy);
  }

  function addRow() {
    const suggestion = suggestNextStage(rows) || "";
    const next = [...rows, { stage: suggestion, date: "" }];
    setRows(next);
    onChange?.(next);
  }

  const canSave = validation.ok && !saving;

  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <DeadlinesRow
          key={i}
          value={r}
          onChange={v => updateRow(i, v)}
          stageOptions={availableOptions[i]}
        />
      ))}

      {!canSave && validation?.message && (
        <div className="text-red-600 text-sm">{validation.message}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded bg-gray-100"
          onClick={addRow}
          disabled={saving}
        >
          Agregar deadline
        </button>

        {!hideSubmit && (
          <button
            type="button"
            className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
            disabled={!canSave}
            onClick={() => {
              if (!canSave) return;
              onSubmit?.(rows);
            }}
          >
            {saving ? "Guardando…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}
