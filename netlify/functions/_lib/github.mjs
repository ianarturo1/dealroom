const GH_API = 'https://api.github.com'

function repoEnv(key, fallback){
  return process.env[key] || fallback || ''
}

function repoParts(repo){
  const [owner, name] = repo.split('/')
  return { owner, name }
}

async function gh(path, method='GET', body){
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN no configurado')
  const res = await fetch(GH_API + path, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'netlify-fns'
    },
    body: body ? JSON.stringify(body) : undefined
  })
  if (!res.ok){
    const txt = await res.text()
    throw new Error(`GitHub ${res.status}: ${txt}`)
  }
  return res.json()
}

async function getFile(repo, path, ref){
  const { owner, name } = repoParts(repo)
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  return gh(`/repos/${owner}/${name}/contents/${encodeURIComponent(path)}${q}`)
}

async function putFile(repo, path, contentBase64, message, sha, branch){
  const { owner, name } = repoParts(repo)
  const body = { message, content: contentBase64 }
  if (sha) body.sha = sha
  if (branch) body.branch = branch
  return gh(`/repos/${owner}/${name}/contents/${encodeURIComponent(path)}`, 'PUT', body)
}

async function listDir(repo, path, ref){
  const { owner, name } = repoParts(repo)
  const q = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  return gh(`/repos/${owner}/${name}/contents/${encodeURIComponent(path)}${q}`)
}

function contentTypeFor(filename){
  const ext = (filename.split('.').pop() || '').toLowerCase()
  const map = {
    'pdf':'application/pdf',
    'doc':'application/msword',
    'docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls':'application/vnd.ms-excel',
    'xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt':'application/vnd.ms-powerpoint',
    'pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg',
    'txt':'text/plain','csv':'text/csv','json':'application/json'
  }
  return map[ext] || 'application/octet-stream'
}

export { repoEnv, getFile, putFile, listDir, contentTypeFor }
