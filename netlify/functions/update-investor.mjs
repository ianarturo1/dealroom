import { json } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'
import { getStageOrder } from '../lib/stages.mjs'
import { validateDeadlines } from '../lib/validators.mjs'

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

const decodeFileContent = (file) => {
  if (!file) return ''
  const encoding = file.encoding || 'base64'
  return Buffer.from(file.content || '', encoding).toString('utf-8')
}

export async function handler(event){
  try {
    if (event.httpMethod && event.httpMethod !== 'POST'){
      return json(405, { ok: false, error: 'Method not allowed' })
    }

    const body = JSON.parse(event.body || '{}')
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!slug){
      return json(400, { ok: false, error: "Missing required field 'slug'" })
    }

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return json(500, { ok: false, error: 'Missing GitHub configuration' })
    }

    const path = `data/investors/${slug}.json`

    let investorFile
    try {
      investorFile = await getFile(repo, path, branch)
    } catch (error) {
      if (isGitHubNotFound(error)){
        return json(404, { ok: false, error: 'Investor not found' })
      }
      throw error
    }

    const current = JSON.parse(decodeFileContent(investorFile) || '{}')
    const existingDeadlines = current && typeof current.deadlines === 'object' ? current.deadlines : {}

    const incomingDeadlines = body.deadlines && typeof body.deadlines === 'object' ? body.deadlines : {}
    const mergedDeadlines = { ...existingDeadlines }
    for (const [stage, value] of Object.entries(incomingDeadlines)){
      if (value === null || value === undefined || value === ''){
        delete mergedDeadlines[stage]
      } else {
        mergedDeadlines[stage] = value
      }
    }

    if (Object.keys(mergedDeadlines).length){
      const order = getStageOrder()
      const validation = validateDeadlines(mergedDeadlines, order)
      if (!validation.ok){
        return json(400, { ok: false, error: validation.error, ...validation.details })
      }
    }

    const updates = {}
    for (const [key, value] of Object.entries(body)){
      if (key === 'slug' || key === 'deadlines' || key === 'id') continue
      if (key === 'name' && typeof value === 'string'){
        updates.name = value.trim()
        continue
      }
      if (key === 'status' && typeof value === 'string'){
        updates.status = value.trim()
        continue
      }
      updates[key] = value
    }

    const updatedInvestor = {
      ...current,
      ...updates,
      id: slug,
      deadlines: mergedDeadlines,
      updatedAt: new Date().toISOString()
    }

    const contentBase64 = Buffer.from(JSON.stringify(updatedInvestor, null, 2)).toString('base64')
    await putFile(
      repo,
      path,
      contentBase64,
      `feat(deadlines): update ${slug}`,
      investorFile?.sha,
      branch
    )

    return json(200, { ok: true })
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
    return json(500, { ok: false, error: message })
  }
}
