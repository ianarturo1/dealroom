export function parseISODate(d){
  if (!d) return null
  const dt = new Date(d)
  return Number.isNaN(+dt) ? null : dt
}

export function daysBetweenUTC(a, b){
  const ms = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
             Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function getDaysTo(dateISO){
  const target = parseISODate(dateISO)
  if (!target) return null
  const today = new Date()
  return daysBetweenUTC(target, today)
}

export function daysFromTodayTo(targetISO){
  const target = parseISODate(targetISO)
  if (!target) return null
  const today = new Date()
  const diff = daysBetweenUTC(today, target) * -1
  return diff === 0 ? 0 : diff
}
