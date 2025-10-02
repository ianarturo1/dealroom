const jsonHeaders = { 'Content-Type': 'application/json' }

async function request(path, { method = 'GET', body } = {}){
  const opts = { method, headers: { ...jsonHeaders } }
  if (method !== 'GET' && body){
    opts.body = JSON.stringify(body)
  }else if (method === 'GET'){
    delete opts.headers['Content-Type']
  }

  const res = await fetch(`/.netlify/functions/${path}`, opts)
  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => '')

  if (!res.ok){
    const message = isJson && payload && typeof payload === 'object'
      ? payload.error || payload.message || `${res.status} ${res.statusText}`
      : (typeof payload === 'string' && payload ? payload : `${res.status} ${res.statusText}`)
    throw new Error(`${path} failed: ${message}`)
  }

  return payload
}

export async function getInvestor(id){
  const query = id ? `get-investor?id=${encodeURIComponent(id)}` : 'get-investor'
  return request(query, { method: 'GET' })
}

export async function updateInvestor({ id, name, status }){
  if (!id) throw new Error('id requerido')
  return request('update-investor', {
    method: 'POST',
    body: { slug: id, name, status }
  })
}

export async function deleteInvestor(id){
  if (!id) throw new Error('id requerido')
  return request('delete-investor', {
    method: 'POST',
    body: { id }
  })
}
