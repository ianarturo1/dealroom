async function req(path, {method='GET', body, headers} = {}){
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const baseHeaders = headers || {}
  const h = isFormData ? { ...baseHeaders } : Object.assign({
    'Content-Type': 'application/json'
  }, baseHeaders)
  const payload = body
    ? (isFormData ? body : JSON.stringify(body))
    : undefined
  const res = await fetch(path, { method, headers: h, body: payload })
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
  downloadDocPath(relPath, { disposition = 'attachment' } = {}){
    const { category, slug, filename } = parseDocPath(relPath)
    return category && slug && filename
      ? api.docDownloadUrl({ category, slug, filename, disposition })
      : '/.netlify/functions/download-file'
  },
  docDownloadUrl({ category, slug, filename, disposition = 'attachment' }){
    const params = new URLSearchParams()
    if (slug) params.set('slug', slug)
    if (category) params.set('category', category)
    if (filename || filename === '') params.set('filename', String(filename))
    if (disposition) params.set('disposition', disposition)
    const qs = params.toString()
    return `/.netlify/functions/download-file${qs ? `?${qs}` : ''}`
  },
  async listActivity(){
    return req('/.netlify/functions/list-activity')
  }
}

function parseDocPath(relPath){
  const normalized = (relPath || '').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length >= 4 && parts[0] === 'data' && parts[1] === 'docs'){
    return {
      slug: parts[2] || '',
      category: parts[3] || '',
      filename: parts.slice(4).join('/') || ''
    }
  }
  if (parts.length >= 3){
    return {
      category: parts[0] || '',
      slug: parts[1] || '',
      filename: parts.slice(2).join('/') || ''
    }
  }
  return { category: '', slug: '', filename: '' }
}
