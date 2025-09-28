import { json } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'
import { decodeIndexContent, buildIndexPayload, normalizeName } from './_lib/investor-index.mjs'
import { getStageOrder } from '../lib/stages.mjs'
import { validateDeadlines } from '../lib/validators.mjs'

const normalizeSlug = (value) => {
  const base = (value || '').toString().trim()
  if (!base) return ''
  return base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const decodeFileContent = (file) => {
  if (!file) return ''
  const encoding = file.encoding || 'base64'
  return Buffer.from(file.content || '', encoding).toString('utf-8')
}

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

export async function handler(event){
  try {
    if (event.httpMethod && event.httpMethod !== 'POST'){
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    const { CONTENT_BRANCH = 'main', SITE_URL } = process.env
    const repo = repoEnv('CONTENT_REPO', '')
    const token = process.env.GITHUB_TOKEN

    if (!token || !repo){
      return json(500, { ok: false, error: 'Missing GitHub configuration' })
    }

    const body = JSON.parse(event.body || '{}')
    const rawName = typeof body.name === 'string' ? body.name : body.companyName
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    if (!name){
      return json(400, { ok: false, error: "Missing required field 'name'" })
    }

    const rawSlug = typeof body.slug === 'string' ? body.slug : body.id
    const slug = normalizeSlug(rawSlug || name)
    if (!slug){
      return json(400, { ok: false, error: 'Unable to derive slug from name' })
    }

    const investorPath = `data/investors/${slug}.json`
    let existingInvestor = null
    try {
      existingInvestor = await getFile(repo, investorPath, CONTENT_BRANCH)
    } catch (error) {
      if (!isGitHubNotFound(error)) throw error
    }

    if (existingInvestor){
      return json(409, { error: 'INVESTOR_EXISTS', message: 'Investor already exists', slug })
    }

    const indexPath = 'data/investor-index.json'
    let indexFile = null
    try {
      indexFile = await getFile(repo, indexPath, CONTENT_BRANCH)
    } catch (error) {
      if (!isGitHubNotFound(error)) throw error
    }

    const decodedIndex = decodeFileContent(indexFile)
    const { entries: indexEntries, rest: indexRest } = decodeIndexContent(decodedIndex)

    const normalizedName = normalizeName(name)
    const duplicateInIndex = indexEntries.find(entry => {
      if (!entry) return false
      if (entry.slug === slug) return true
      return normalizeName(entry.name) === normalizedName
    })

    if (duplicateInIndex){
      return json(409, { error: 'INVESTOR_EXISTS', message: 'Investor already exists', slug })
    }

    const extras = { ...body }
    delete extras.slug
    delete extras.id
    delete extras.companyName
    delete extras.name

    const rawEmail = typeof extras.email === 'string' ? extras.email.trim() : ''
    const rawStatus = typeof extras.status === 'string' ? extras.status.trim() : ''
    delete extras.email
    delete extras.status

    const deadlines = extras.deadlines && typeof extras.deadlines === 'object' ? extras.deadlines : {}
    const metrics = extras.metrics && typeof extras.metrics === 'object' ? extras.metrics : {}
    const uiPayload = extras.ui && typeof extras.ui === 'object' ? extras.ui : {}

    delete extras.deadlines
    delete extras.metrics
    delete extras.ui

    if (deadlines && Object.keys(deadlines).length){
      const order = getStageOrder()
      const validation = validateDeadlines(deadlines, order)
      if (!validation.ok){
        return json(400, { ok: false, error: validation.error, ...validation.details })
      }
    }

    const nowISO = new Date().toISOString()
    const investor = {
      id: slug,
      name,
      status: rawStatus || 'Primera reunión',
      deadlines,
      metrics,
      ui: {
        panelTitle: typeof uiPayload.panelTitle === 'string' && uiPayload.panelTitle.trim()
          ? uiPayload.panelTitle.trim()
          : `Panel ${name}`,
        theme: uiPayload.theme && typeof uiPayload.theme === 'object' ? { ...uiPayload.theme } : {},
        ...Object.fromEntries(
          Object.entries(uiPayload).filter(([key]) => key !== 'panelTitle' && key !== 'theme')
        )
      },
      createdAt: nowISO,
      updatedAt: nowISO,
      ...extras
    }

    if (rawEmail){
      investor.email = rawEmail
    }

    const investorContent = Buffer.from(JSON.stringify(investor, null, 2)).toString('base64')
    await putFile(repo, investorPath, investorContent, `feat(investor): create ${slug}`, undefined, CONTENT_BRANCH)

    const indexEntry = {
      slug,
      name,
      email: investor.email || '',
      status: investor.status || '',
      createdAt: nowISO,
      updatedAt: nowISO
    }

    const nextIndex = buildIndexPayload([...indexEntries, indexEntry], indexRest)
    const indexJson = JSON.stringify(nextIndex, null, 2)
    const indexContent = Buffer.from(indexJson).toString('base64')
    await putFile(
      repo,
      indexPath,
      indexContent,
      `feat(investor-index): add ${slug}`,
      indexFile?.sha,
      CONTENT_BRANCH
    )

    const baseSite = (SITE_URL || '').trim().replace(/\/$/, '') || 'https://taxdealroom.netlify.app'
    const link = `${baseSite}/#/?investor=${encodeURIComponent(slug)}`

    return json(200, { ok: true, slug, link })
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
    return json(500, { ok: false, error: message })
  }
}
