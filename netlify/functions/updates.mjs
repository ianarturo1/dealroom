import { json, ok, text } from './_lib/utils.mjs'
import { repoEnv } from './_lib/github.mjs'

const GH_API = 'https://api.github.com'
const PUBLIC_SLUG = normalizeSlug(process.env.PUBLIC_INVESTOR_SLUG)
const MAX_LIMIT = 50

function normalizeSlug(value){
  return (value || '').trim().toLowerCase()
}

function defaultHeaders(){
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'dealroom-updates'
  }
}

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

async function listCommits(repo, { branch, perPage = 60 } = {}){
  const { owner, name } = parseRepo(repo)
  const params = new URLSearchParams({ per_page: String(perPage) })
  if (branch) params.set('sha', branch)
  return gh(`/repos/${owner}/${name}/commits?${params.toString()}`)
}

async function getCommit(repo, sha){
  const { owner, name } = parseRepo(repo)
  return gh(`/repos/${owner}/${name}/commits/${sha}`)
}

function iso(value){
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

function firstLine(message){
  return (message || '').split('\n')[0].trim()
}

function escapeRegex(value){
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function detectMessageEvents({ slug, repoLabel, sha, message, ts, actor }){
  if (!message || !slug) return []
  const lower = message.toLowerCase()
  if (!lower.includes(slug)) return []
  const events = []
  const summary = firstLine(message)
  const slugRegex = new RegExp(`\\b${escapeRegex(slug)}\\b`, 'i')

  const isDeadlines = /feat\(\s*deadlines\s*\)/i.test(message) || /deadlines?/i.test(message)
  if (isDeadlines && slugRegex.test(message)){
    events.push({
      id: `${repoLabel}-${sha}-msg-deadlines`,
      slug,
      type: 'deadlines_update',
      title: summary || 'Actualización de deadlines',
      ts,
      actor,
      repo: repoLabel,
      path: ''
    })
  }

  const statusRegex = /(status:|update status|status update)/i
  if (statusRegex.test(message)){
    events.push({
      id: `${repoLabel}-${sha}-msg-status`,
      slug,
      type: 'status_change',
      title: summary || 'Cambio de estatus',
      ts,
      actor,
      repo: repoLabel,
      path: ''
    })
  }

  return events
}

function detectInvestorEvents({ file, slug, repoLabel, sha, ts, actor, message }){
  const events = []
  const filename = String(file?.filename || '')
  const lowered = filename.toLowerCase()
  if (!slug) return events

  if (lowered === `data/investors/${slug}.json`){
    events.push({
      id: `${repoLabel}-${sha}-${filename}`,
      slug,
      type: 'investor_update',
      title: 'Actualización de datos del inversionista',
      ts,
      actor,
      repo: repoLabel,
      path: filename
    })
  }else if (lowered === 'data/investor-index.json'){
    const lines = String(file.patch || '')
      .split('\n')
      .filter((line) => line.startsWith('+'))
    const patchMentions = lines.some((line) => line.toLowerCase().includes(slug))
    const msgMentions = /\badd\b/i.test(message || '') && (message || '').toLowerCase().includes(slug)
    if (patchMentions || msgMentions){
      events.push({
        id: `${repoLabel}-${sha}-${filename}-created`,
        slug,
        type: 'investor_created',
        title: 'Alta de inversionista',
        ts,
        actor,
        repo: repoLabel,
        path: filename
      })
    }
  }

  return events
}

function detectDocEvents({ file, slug, repoLabel, sha, ts, actor }){
  const events = []
  const filename = String(file?.filename || '')
  if (!filename.includes('/')) return events
  const segments = filename.split('/')
  if (segments.length < 2) return events
  const maybeSlug = normalizeSlug(segments[1])
  if (maybeSlug !== slug) return events
  const status = file.status || ''
  let type = 'doc_update'
  if (status === 'added') type = 'doc_upload'
  else if (status === 'removed') type = 'doc_delete'

  events.push({
    id: `${repoLabel}-${sha}-${filename}`,
    slug,
    type,
    title: `${typeLabel(type)}: ${segments.slice(2).join('/') || segments[segments.length - 1]}`,
    ts,
    actor,
    repo: repoLabel,
    path: filename
  })
  return events
}

function typeLabel(type){
  switch(type){
    case 'doc_upload': return 'Documento subido'
    case 'doc_delete': return 'Documento eliminado'
    case 'doc_update': return 'Documento actualizado'
    case 'deadlines_update': return 'Actualización de deadlines'
    case 'status_change': return 'Cambio de estatus'
    case 'investor_created': return 'Alta de inversionista'
    case 'investor_update': return 'Actualización de datos'
    default: return 'Actualización'
  }
}

export async function handler(event){
  try{
    if (event.httpMethod !== 'GET'){
      return text(405, 'Method Not Allowed')
    }

    const rawUrl = event.rawUrl || ''
    let url
    try{
      url = new URL(rawUrl)
    }catch{
      const fallback = `http://localhost${event.path || '/'}`
      url = new URL(fallback)
      const qs = event.queryStringParameters || {}
      for (const [key, value] of Object.entries(qs)){
        if (typeof value === 'string') url.searchParams.set(key, value)
      }
    }
    const requestedSlug = normalizeSlug(url.searchParams.get('slug') || PUBLIC_SLUG)
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get('limit') || '50', 10) || 0, 1),
      MAX_LIMIT
    )

    if (!requestedSlug){
      return json(400, { error: 'MISSING_SLUG', message: 'Missing slug' })
    }
    if (!PUBLIC_SLUG){
      return json(500, { error: 'MISSING_ENV_SLUG', message: 'PUBLIC_INVESTOR_SLUG no configurado' })
    }
    if (requestedSlug !== PUBLIC_SLUG){
      return json(403, { error: 'FORBIDDEN', message: 'Forbidden: slug mismatch' })
    }

    if (!process.env.GITHUB_TOKEN){
      return ok({ ok: true, slug: requestedSlug, items: [] })
    }

    const repos = []
    const contentRepo = repoEnv('CONTENT_REPO', '')
    const docsRepo = repoEnv('DOCS_REPO', '')
    if (contentRepo){
      repos.push({
        repo: contentRepo,
        label: 'content',
        branch: process.env.CONTENT_BRANCH || 'main',
        handler: detectInvestorEvents
      })
    }
    if (docsRepo){
      repos.push({
        repo: docsRepo,
        label: 'docs',
        branch: process.env.DOCS_BRANCH || 'main',
        handler: detectDocEvents
      })
    }

    const events = []

    for (const repoInfo of repos){
      const commits = await listCommits(repoInfo.repo, { branch: repoInfo.branch, perPage: 80 })
      for (const commit of commits){
        const detail = await getCommit(repoInfo.repo, commit.sha)
        const commitMessage = detail?.commit?.message || commit?.commit?.message || ''
        const commitTs = iso(
          commit?.commit?.author?.date ||
          commit?.commit?.committer?.date ||
          detail?.commit?.author?.date ||
          detail?.commit?.committer?.date
        )
        const actor = commit?.author?.login || commit?.commit?.author?.name || 'unknown'

        const messageEvents = detectMessageEvents({
          slug: requestedSlug,
          repoLabel: repoInfo.label,
          sha: commit.sha,
          message: commitMessage,
          ts: commitTs,
          actor
        })
        for (const evt of messageEvents){
          events.push(evt)
        }

        for (const file of detail?.files || []){
          const handler = repoInfo.handler
          const fileEvents = handler({
            file,
            slug: requestedSlug,
            repoLabel: repoInfo.label,
            sha: commit.sha,
            ts: commitTs,
            actor,
            message: commitMessage
          })
          for (const evt of fileEvents){
            events.push(evt)
          }
        }
      }
    }

    events.sort((a, b) => b.ts.localeCompare(a.ts))
    const unique = new Map()
    for (const evt of events){
      if (!evt || !evt.id) continue
      if (!unique.has(evt.id)){
        unique.set(evt.id, evt)
      }
    }
    const items = Array.from(unique.values()).slice(0, limit)

    return ok({ ok: true, slug: requestedSlug, items })
  }catch(error){
    return json(500, { error: 'SERVER_ERROR', message: error.message })
  }
}
