export function normalizeDeadlineKey(inputKey) {
  const k = String(inputKey || '').trim().toLowerCase()
  if (!k) return ''

  if (k === 'firma' || k.startsWith('firma ')) return 'Firma'
  if (k.includes('firma') && k.includes('contrato')) return 'Firma'

  return String(inputKey || '').trim()
}

export function isValidISODate(d) {
  if (typeof d !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const dt = new Date(d)
  const [y, m, day] = d.split('-').map(n => parseInt(n, 10))
  return (
    !Number.isNaN(+dt) &&
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === day
  )
}
