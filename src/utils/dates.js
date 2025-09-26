// src/utils/dates.js

/**
 * Parsea una fecha ISO (YYYY-MM-DD) y devuelve Date o null si es inválida.
 */
export function parseISODate(d) {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(+dt) ? null : dt;
}

/**
 * Diferencia en días entre dos fechas normalizadas a UTC (a - b).
 * Positivo si 'a' es después de 'b'; negativo si 'a' es antes de 'b'.
 */
export function daysBetweenUTC(a, b) {
  const ms =
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Días desde HOY hasta la fecha objetivo.
 * Positivo si falta (futuro), 0 si es hoy, negativo si ya venció (pasado).
 */
export function daysFromTodayTo(targetISO) {
  const target = parseISODate(targetISO);
  if (!target) return null;
  const today = new Date();
  const diff = -daysBetweenUTC(today, target);
  return diff === 0 ? 0 : diff;
}

/**
 * Días entre una fecha objetivo y HOY (target - today).
 * Equivalente a daysBetweenUTC(target, today). Positivo si futuro.
 */
export function getDaysTo(dateISO) {
  const target = parseISODate(dateISO);
  if (!target) return null;
  const today = new Date();
  return daysBetweenUTC(target, today);
}
