// /netlify/lib/validators.mjs
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(s) {
  if (typeof s !== "string" || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Valida:
 * 1) Formato de cada fecha (YYYY-MM-DD)
 * 2) Orden cronológico no decreciente según getStageOrder()
 * Devuelve { ok: true } o { ok: false, error, details }
 */
export function validateDeadlines(deadlines, stageOrder) {
  const dl = deadlines || {};
  const order = Array.isArray(stageOrder) ? stageOrder : [];
  const allowedStages = new Set(order);

  // 1) formato y nombres válidos
  for (const [k, v] of Object.entries(dl)) {
    if (!allowedStages.has(k)) {
      return {
        ok: false,
        error: "DEADLINE_STAGE_INVALID",
        details: { field: k, allowed: order }
      };
    }
    if (!isValidISODate(v)) {
      return {
        ok: false,
        error: "DEADLINE_FORMAT_INVALID",
        details: { field: k, value: v, expected: "YYYY-MM-DD" }
      };
    }
  }

  // 2) orden (lexicográfico funciona con ISO: "2025-09-28" < "2025-10-01")
  const presentStages = order.filter((s) => dl[s]);
  for (let i = 0; i < presentStages.length - 1; i++) {
    const a = presentStages[i];
    const b = presentStages[i + 1];
    if (dl[a] > dl[b]) {
      return {
        ok: false,
        error: "DEADLINE_ORDER_INVALID",
        details: {
          a,
          b,
          aDate: dl[a],
          bDate: dl[b],
          rule: `"${a}" <= "${b}"`,
          message: `La fecha de "${a}" (${dl[a]}) no puede ser posterior a "${b}" (${dl[b]}).`
        }
      };
    }
  }
  return { ok: true };
}
