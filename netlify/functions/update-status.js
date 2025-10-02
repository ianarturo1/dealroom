import { Buffer } from 'node:buffer'
import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

export async function handler(event){
  try{
    const body = JSON.parse(event.body || '{}')
    const normalizedId = typeof body.id === 'string'
      ? body.id.trim().toLowerCase()
      : ''
    if (!normalizedId) return text(400, 'Falta id (slug) de inversionista')

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return text(500, 'CONTENT_REPO/GITHUB_TOKEN no configurados')
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
    return ok({ ok:true, commit: res.commit && res.commit.sha })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
