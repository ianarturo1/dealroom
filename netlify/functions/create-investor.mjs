import { ok, text, requireUser, hasAnyRole } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

function normalizeSlug(s){
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

const GENERIC_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com',
  'aol.com','live.com','msn.com','protonmail.com'
])

export async function handler(event, context){
  try{
    const user = requireUser(context)
    if (!hasAnyRole(user, ['admin','ri'])) return text(403, 'Requiere rol admin o ri')

    const body = JSON.parse(event.body || '{}')
    if (!body.email || !body.companyName) return text(400, 'Faltan campos obligatorios')

    const status = body.status || 'NDA'
    const email = body.email.toLowerCase()
    if (!email.includes('@')) return text(400, 'Email inválido')
    const domain = email.split('@')[1]
    const generic = GENERIC_DOMAINS.has(domain)

    let slug = normalizeSlug(body.slug || '')
    if (!slug){
      if (generic){
        slug = normalizeSlug(body.companyName)
      }else{
        slug = normalizeSlug(domain.split('.')[0])
      }
    }

    const deadlines = body.deadlines || {}

    const contentRepo = repoEnv('CONTENT_REPO', '')
    const contentBranch = process.env.CONTENT_BRANCH || 'main'
    const docsRepo = repoEnv('DOCS_REPO', '')
    const docsBranch = process.env.DOCS_BRANCH || 'main'
    if (!contentRepo || !docsRepo || !process.env.GITHUB_TOKEN){
      return text(500, 'CONTENT_REPO/DOCS_REPO/GITHUB_TOKEN no configurados')
    }
    const investorData = {
      id: slug,
      name: body.companyName,
      status,
      deadlines,
      metrics: { decisionTime: 45, investorsActive: 1, dealsAccelerated: 0, nps: 70 }
    }
    const invContent = Buffer.from(JSON.stringify(investorData, null, 2)).toString('base64')
    
    // Step A: update domain -> slug index
    const idxPath = 'data/investor-index.json'
    let indexSha = null
    try {
      const idxFile = await getFile(contentRepo, idxPath, contentBranch)
      const idxJson = JSON.parse(Buffer.from(idxFile.content, idxFile.encoding || 'base64').toString('utf-8'))
      idxJson.domains = idxJson.domains || {}
      idxJson.domains[domain] = slug
      const idxContent = Buffer.from(JSON.stringify(idxJson, null, 2)).toString('base64')
      const resIdx = await putFile(contentRepo, idxPath, idxContent, `add investor ${slug} to index`, idxFile.sha, contentBranch)
      indexSha = resIdx.commit && resIdx.commit.sha
    } catch (_) {
      const idxJson = { domains: { [domain]: slug } }
      const idxContent = Buffer.from(JSON.stringify(idxJson, null, 2)).toString('base64')
      const resIdx = await putFile(contentRepo, idxPath, idxContent, `create investor index with ${slug}`, undefined, contentBranch)
      indexSha = resIdx.commit && resIdx.commit.sha
    }

    // Step B: create investor data file
    const investorPath = `data/investors/${slug}.json`
    const resInv = await putFile(contentRepo, investorPath, invContent, `create investor ${slug}`, undefined, contentBranch)
    const investorSha = resInv.commit && resInv.commit.sha

    // Step C: scaffold docs folders
    const categories = ['NDA','Propuestas','Contratos','LOIs','Sustento fiscal','Mitigación de riesgos','Procesos']
    let docsSha = null
    for (const cat of categories){
      const path = `${cat}/${slug}/.keep`
      try{
        await getFile(docsRepo, path, docsBranch)
      }catch(_){
        const res = await putFile(docsRepo, path, Buffer.from('').toString('base64'), `scaffold docs folders for ${slug}`, undefined, docsBranch)
        docsSha = res.commit && res.commit.sha
      }
    }

    // Step D: invite via Netlify Identity Admin API
    const token = process.env.IDENTITY_ADMIN_TOKEN
    if (!token) return text(500, 'configure IDENTITY_ADMIN_TOKEN')
    const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`
    let invite = 'sent'
    const resId = await fetch(`${siteUrl}/.netlify/identity/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, app_metadata: { roles: ['investor'] } })
    })
    if (!resId.ok){
      if (resId.status === 409 || resId.status === 422){
        invite = 'exists'
      }else{
        const msg = await resId.text()
        throw new Error(`Identity ${resId.status}: ${msg}`)
      }
    }

    return ok({
      ok: true,
      slug,
      domain,
      commits: { index: indexSha, investor: investorSha, docs: docsSha },
      invite
    })
  }catch(err){
    return text(500, err.message)
  }
}
