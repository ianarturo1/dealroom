import { Buffer } from 'node:buffer'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'
import { getStageOrder } from '../lib/stages.mjs'
import { validateDeadlines } from '../lib/validators.mjs'
import { json, errorJson } from './_shared/http.mjs'

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

const decodeFileContent = (file) => {
  if (!file) return ''
  const encoding = file.encoding || 'base64'
  return Buffer.from(file.content || '', encoding).toString('utf-8')
}

export default async function handler(request, context){
  try {
    if (request.method && request.method !== 'POST'){
      return json({ ok: false, error: 'Method not allowed' }, { status: 405 })
    }

    let body = {}
    try{
      body = await request.json()
    }catch(_){
      body = {}
    }
    const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
    if (!slug){
      return json({ ok: false, error: "Missing required field 'slug'" }, { status: 400 })
    }

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return errorJson('Missing GitHub configuration')
    }

    const path = `data/investors/${slug}.json`

    let investorFile
    try {
      investorFile = await getFile(repo, path, branch)
    } catch (error) {
      if (isGitHubNotFound(error)){
        return json({ ok: false, error: 'Investor not found' }, { status: 404 })
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
        return json({ ok: false, error: validation.error, ...validation.details }, { status: 400 })
      }
    }

    const updatedInvestor = {
      ...current,
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

    return json({ ok: true })
  } catch (error) {
    const message = String(error && error.message ? error.message : error)
    return errorJson(message || 'Internal error')
  }
}
