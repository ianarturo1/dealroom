import { Buffer } from 'node:buffer'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'
import { json, errorJson, badRequest } from './_shared/http.mjs'

export default async function handler(request, context){
  try{
    let body = {}
    try{
      body = await request.json()
    }catch(_){
      body = {}
    }
    const normalizedId = typeof body.id === 'string'
      ? body.id.trim().toLowerCase()
      : ''
    if (!normalizedId) return badRequest('Falta id (slug) de inversionista')

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return errorJson('CONTENT_REPO/GITHUB_TOKEN no configurados')
    }
    const payload = { ...body, id: normalizedId }
    const path = `data/investors/${normalizedId}.json`

    let sha = undefined
    try {
      const f = await getFile(repo, path, branch)
      sha = f.sha
    }catch(_){ /* new file */ }

    const contentBase64 = Buffer.from(JSON.stringify(payload, null, 2)).toString('base64')
    const res = await putFile(repo, path, contentBase64, `Update investor ${normalizedId} via Dealroom`, sha, branch)
    return json({ ok:true, commit: res.commit && res.commit.sha })
  }catch(err){
    const status = err.statusCode || 500
    return errorJson(err.message || 'Internal error', status)
  }
}
