async function req(path, {method='GET', body, headers} = {}){
  const h = Object.assign({
    'Content-Type': 'application/json'
  }, headers || {})
  const res = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok){
    const msg = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${msg}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res.text()
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
  async uploadProjectImage(projectId, file){
    if (!projectId) throw new Error('Falta projectId para la imagen')
    if (!file || (typeof File !== 'undefined' && !(file instanceof File))){
      throw new Error('Archivo de imagen inválido')
    }

    const formData = new FormData()
    formData.append('file', file)

    const url = `/.netlify/functions/upload-project-image?projectId=${encodeURIComponent(projectId)}`
    const res = await fetch(url, { method: 'POST', body: formData })
    const contentType = res.headers.get('content-type') || ''

    if (!res.ok){
      if (contentType.includes('application/json')){
        const json = await res.json()
        const message = json && (json.error || json.message || json.msg)
        throw new Error(message || JSON.stringify(json) || 'No se pudo subir la imagen')
      }
      const errText = await res.text()
      throw new Error(errText || 'No se pudo subir la imagen')
    }

    const data = contentType.includes('application/json') ? await res.json() : null
    if (!data || typeof data.imageUrl !== 'string' || !data.imageUrl){
      throw new Error('Respuesta inválida al subir la imagen')
    }

    return data
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
  }
}
