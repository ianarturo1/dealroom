import { ok, text } from './_lib/utils.mjs'
import { repoEnv } from './_lib/github.mjs'

const GH_API = 'https://api.github.com'

const defaultHeaders = () => ({
  'Accept': 'application/vnd.github+json',
  'User-Agent': 'dealroom-admin'
})

function requireToken(){
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN no configurado')
  return token
}

function parseRepo(repo){
  const [owner, name] = String(repo || '').split('/')
  if (!owner || !name) throw new Error(`Repositorio inválido: ${repo}`)
  return { owner, name }
}

async function gh(path, init = {}){
  const token = requireToken()
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      ...defaultHeaders(),
      Authorization: `Bearer ${token}`,
      ...(init.headers || {})
    }
  })
  if (!res.ok){
    const txt = await res.text().catch(() => '')
    throw new Error(`GitHub ${res.status}: ${txt}`)
  }
  return res.json()
}

async function listCommits(repo, { branch, path, perPage = 10 } = {}){
  const { owner, name } = parseRepo(repo)
  const params = new URLSearchParams({ per_page: String(perPage) })
  if (branch) params.set('sha', branch)
  if (path) params.set('path', path)
  return gh(`/repos/${owner}/${name}/commits?${params.toString()}`)
}

async function getCommit(repo, sha){
  const { owner, name } = parseRepo(repo)
  return gh(`/repos/${owner}/${name}/commits/${sha}`)
}

function normalizeSlug(input){
  return (input || '').trim().toLowerCase()
}

async function loadInvestorEvents(){
  const repo = repoEnv('CONTENT_REPO', '')
  if (!repo) return []
  const branch = process.env.CONTENT_BRANCH || 'main'
  const commits = await listCommits(repo, { branch, path: 'data/investors', perPage: 12 })
  const events = []
  for (const commit of commits){
    const detail = await getCommit(repo, commit.sha)
    const commitDate = commit?.commit?.author?.date || commit?.commit?.committer?.date || detail?.commit?.author?.date
    for (const file of detail.files || []){
      if (!file.filename || !file.filename.startsWith('data/investors/')) continue
      const slug = normalizeSlug(file.filename.replace('data/investors/', '').replace(/\.json$/i, ''))
      if (!slug) continue
      let type = 'investor-updated'
      if (file.status === 'added') type = 'investor-created'
      else if (file.status === 'removed') type = 'investor-deleted'
      events.push({
        type,
        slug,
        path: file.filename,
        sha: commit.sha,
        date: commitDate,
        message: detail?.commit?.message || ''
      })
    }
  }
  return events
}

async function loadDocEvents(){
  const repo = repoEnv('DOCS_REPO', '')
  if (!repo) return []
  const branch = process.env.DOCS_BRANCH || 'main'
  const commits = await listCommits(repo, { branch, perPage: 12 })
  const events = []
  for (const commit of commits){
    const detail = await getCommit(repo, commit.sha)
    const commitDate = commit?.commit?.author?.date || commit?.commit?.committer?.date || detail?.commit?.author?.date
    for (const file of detail.files || []){
      const segments = (file.filename || '').split('/')
      if (segments.length < 3) continue
      const [category, slugRaw, ...rest] = segments
      const slug = normalizeSlug(slugRaw)
      if (!slug) continue
      const filename = rest.join('/')
      let type = 'doc-uploaded'
      if (file.status === 'removed') type = 'doc-deleted'
      events.push({
        type,
        category,
        slug,
        filename,
        path: file.filename,
        sha: commit.sha,
        date: commitDate,
        message: detail?.commit?.message || ''
      })
    }
  }
  return events
}

export async function handler(){
  try {
    // Si no hay token, no intentamos llamar a GitHub (evita 500 en deploy preview)
    if (!process.env.GITHUB_TOKEN){
      return ok({ events: [] })
    }

    const [investorEvents, docEvents] = await Promise.all([
      loadInvestorEvents(),
      loadDocEvents()
    ])

    const events = [...investorEvents, ...docEvents]
      .filter(event => event && event.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 25)

    return ok({ events })
  }catch(error){
    return text(500, error.message)
  }
}
