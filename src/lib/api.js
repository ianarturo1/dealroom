async function req(path, {method='GET', body, headers} = {}){
  const h = Object.assign({
    'Content-Type': 'application/json'
  }, headers || {})
  const res = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')
  if (!res.ok){
    const message = isJson
      ? (payload && typeof payload === 'object' ? (payload.message || payload.error || `${res.status} ${res.statusText}`) : `${res.status} ${res.statusText}`)
      : (typeof payload === 'string' && payload ? payload : `${res.status} ${res.statusText}`)
    const error = new Error(message)
    error.status = res.status
    error.statusText = res.statusText
    error.data = payload
    throw error
  }
  return isJson ? payload : payload
}

export const api = {
  listProjects(){ return req('/.netlify/functions/list-projects') },
  saveProjects(projects){
    return req('/.netlify/functions/save-projects', {
      method: 'POST',
      body: { projects }
    })
  },
  listInvestors(){ return req('/.netlify/functions/list-investors') },
  deleteInvestor(slug){
    return req('/.netlify/functions/delete-investor', {
      method: 'POST',
      body: { slug }
    })
  },
  getInvestor(slug){ return req(`/.netlify/functions/get-investor${slug ? ('?slug='+encodeURIComponent(slug)) : ''}`) },
  listDocs(params){
    const q = new URLSearchParams(params || {}).toString()
    return req(`/.netlify/functions/list-docs${q ? ('?'+q) : ''}`)
  },
  async uploadDoc(info){
    return req('/.netlify/functions/upload-doc', { method:'POST', body: info })
  },
  async deleteDoc(info){
    return req('/.netlify/functions/delete-doc', { method:'POST', body: info })
  },
  async updateStatus(payload){
    return req('/.netlify/functions/update-status', { method:'POST', body: payload })
  },
  async createInvestor(payload){
    return req('/.netlify/functions/create-investor', { method:'POST', body: payload })
  },
  calendarIcsUrl(slug){
    return `/.netlify/functions/calendar?slug=${encodeURIComponent(slug)}`
  },
  downloadDocPath(relPath){
    const normalized = (relPath || '').replace(/^\/+/, '')
    const parts = normalized.split('/').filter(Boolean)
    const slug = parts.length > 1 ? parts[1] : ''
    const params = new URLSearchParams()
    if (normalized) params.set('path', normalized)
    if (slug) params.set('investor', slug)
    const qs = params.toString()
    return `/.netlify/functions/get-doc${qs ? `?${qs}` : ''}`
  },
  async listActivity(){
    return req('/.netlify/functions/list-activity')
  },
  async listUpdates(params){
    const q = new URLSearchParams(params || {}).toString()
    return req(`/.netlify/functions/updates${q ? `?${q}` : ''}`)
  }
}
