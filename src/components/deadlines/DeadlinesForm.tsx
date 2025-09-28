import { useEffect, useMemo, useState } from "react";
import { DeadlinesRow } from "./DeadlinesRow";
import { suggestNextStage, validateRows, normalize } from "@/lib/deadlineValidators";
import { STAGES } from "@/lib/stages";

type Row = { stage?: string; date?: string };

type Props = {
  initial?: Row[];
  onChange?: (rows: Row[]) => void;
  onSubmit?: (rows: Row[]) => void | Promise<void>;
  saving?: boolean;
};

const EMPTY_ROW: Row = { stage: "", date: "" };

export function DeadlinesForm({ initial = [], onChange, onSubmit, saving = false }: Props) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [EMPTY_ROW]);
  const serializedInitial = useMemo(() => JSON.stringify(initial || []), [initial]);

  useEffect(() => {
    const base = initial.length ? initial : [EMPTY_ROW];
    setRows(base.map(item => ({ ...item })));
  }, [serializedInitial, initial]);

  const stageByNorm = useMemo(() => {
    const map: Record<string, string> = {};
    STAGES.forEach(stage => {
      map[normalize(stage)] = stage;
    });
    return map;
  }, []);

  const { validation, availableOptions } = useMemo(() => {
    const validationResult = validateRows(rows);

    const usedCanonical = rows
      .map(row => stageByNorm[normalize(row.stage || "")])
      .filter(Boolean) as string[];

    const options = rows.map(row => {
      const canonical = stageByNorm[normalize(row.stage || "")];
      const blocked = new Set(usedCanonical);
      if (canonical) blocked.delete(canonical);
      return STAGES.filter(stage => !blocked.has(stage));
    });

    return { validation: validationResult, availableOptions: options };
  }, [rows, stageByNorm]);

  function updateRow(i: number, next: Row) {
    const copy = rows.slice();
    copy[i] = next;
    setRows(copy);
    onChange?.(copy);
  }

  function addRow() {
    const suggestion = suggestNextStage(rows) || "";
    const nextRows = [...rows, { stage: suggestion, date: "" }];
    setRows(nextRows);
    onChange?.(nextRows);
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

      {!validation.ok && validation?.message && (
        <div className="text-red-600 text-sm">{validation.message}</div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded bg-gray-100"
          onClick={addRow}
        >
          Agregar deadline
        </button>

        <button
          type="button"
          className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50"
          disabled={!canSave}
          onClick={() => {
            if (!validation.ok || saving) return;
            onSubmit?.(rows);
          }}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
