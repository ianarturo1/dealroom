async function req(path, {method='GET', body, headers} = {}){
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const h = Object.assign({}, headers || {})
  if (!isFormData){
    h['Content-Type'] = h['Content-Type'] || 'application/json'
  }
  const fetchOptions = { method, headers: h }
  if (body !== undefined){
    fetchOptions.body = isFormData ? body : JSON.stringify(body)
  }
  const res = await fetch(path, fetchOptions)
  const ct = res.headers.get('content-type') || ''
  const isJson = ct.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')
  if (!res.ok){
    const message = isJson
      ? (payload && typeof payload === 'object'
        ? (payload.message || payload.msg || payload.error || payload.code || `${res.status} ${res.statusText}`)
        : `${res.status} ${res.statusText}`)
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
  async uploadDoc(info, options = {}){
    const endpoint = options.endpoint || '/.netlify/functions/upload-doc'
    return req(endpoint, { method:'POST', body: info })
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
  downloadDocPath(relPath, options = {}){
    const disposition = (options && options.disposition) || 'attachment'
    const normalized = (relPath || '').replace(/^\/+/, '')
    const parts = normalized.split('/').filter(Boolean)
    if (parts.length >= 5 && parts[0] === 'data' && parts[1] === 'docs'){
      const slug = parts[2]
      const category = parts[3]
      const filename = parts.slice(4).join('/')
      return this.docDownloadUrl({ category, slug, filename, disposition })
    }
    if (parts.length >= 3){
      const [category, slug, ...rest] = parts
      const filename = rest.join('/')
      if ((slug || '').toLowerCase() === 'alsea'){
        return this.docDownloadUrl({ category, slug, filename, disposition })
      }
    }
    const legacySlug = parts.length > 1 ? parts[1] : ''
    const params = new URLSearchParams()
    if (normalized) params.set('path', normalized)
    if (legacySlug) params.set('investor', legacySlug)
    const qs = params.toString()
    return `/.netlify/functions/get-doc${qs ? `?${qs}` : ''}`
  },
  docDownloadUrl({ category, slug, filename, disposition = 'attachment' }){
    const normalizedSlug = (slug || '').trim().toLowerCase()
    const normalizedCategory = (category || '').trim()
    const normalizedFilename = filename === undefined || filename === null ? '' : String(filename)
    const safeDisposition = disposition === 'inline' ? 'inline' : 'attachment'
    const isFeatureOn = import.meta.env?.VITE_DOCS_BACKEND_ALSEA === 'on'
    if (normalizedSlug === 'alsea' && isFeatureOn){
      const params = new URLSearchParams()
      params.set('slug', 'alsea')
      if (normalizedCategory) params.set('category', normalizedCategory)
      if (normalizedFilename) params.set('filename', normalizedFilename)
      params.set('disposition', safeDisposition)
      const qs = params.toString()
      return `/.netlify/functions/download-file${qs ? `?${qs}` : ''}`
    }
    const params = new URLSearchParams()
    if (normalizedCategory) params.set('category', normalizedCategory)
    if (slug) params.set('slug', slug)
    if (normalizedFilename) params.set('filename', normalizedFilename)
    const qs = params.toString()
    return `/.netlify/functions/get-doc${qs ? `?${qs}` : ''}`
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
