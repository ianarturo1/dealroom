const JSON_CT = 'application/json'

async function request(path, { method = 'GET', body, query } = {}) {
  let url = `/.netlify/functions/${path}`
  if (query && typeof query === 'object') {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      params.set(key, String(value))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }

  const headers = {}
  const init = { method, headers }

  const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD'
  if (hasBody) {
    headers['Content-Type'] = JSON_CT
    init.body = JSON.stringify(body)
  }

  const res = await fetch(url, init)
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`${path} failed (${res.status}): ${txt}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return res.json()
  }
  return null
}

const normalizeSlug = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

export async function getInvestor(id) {
  const slug = normalizeSlug(id)
  if (!slug) throw new Error('id requerido')
  return request('get-investor', { method: 'GET', query: { id: slug } })
}

export async function updateInvestor(payload) {
  const slug = normalizeSlug(payload?.id ?? payload?.slug)
  if (!slug) throw new Error('id requerido')
  const body = { ...payload, slug }
  delete body.id
  return request('update-investor', { method: 'POST', body })
}

export async function deleteInvestor(id) {
  const slug = normalizeSlug(id)
  if (!slug) throw new Error('id requerido')
  return request('delete-investor', { method: 'POST', body: { id: slug } })
}
