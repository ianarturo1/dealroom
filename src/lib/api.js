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
  getInvestor(slug){ return req(`/.netlify/functions/get-investor${slug ? ('?slug='+encodeURIComponent(slug)) : ''}`) },
  listDocs(params){ 
    const q = new URLSearchParams(params || {}).toString()
    return req(`/.netlify/functions/list-docs${q ? ('?'+q) : ''}`) 
  },
  async uploadDoc(info){
    return req('/.netlify/functions/upload-doc', { method:'POST', body: info })
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
    return `/.netlify/functions/get-doc?path=${encodeURIComponent(relPath)}`
  }
}
