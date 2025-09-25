import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'
import { STAGES } from './_lib/pipeline.mjs'

const ALLOWED_STATUS = new Set(STAGES)

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
    const rawStatus = typeof body.status === 'string' ? body.status : undefined
    const normalizedStatus = typeof rawStatus === 'string' ? rawStatus.trim() : undefined

    if (normalizedStatus && !ALLOWED_STATUS.has(normalizedStatus)){
      return text(400, 'Estado del pipeline no permitido')
    }

    const payload = { ...body, id: normalizedId }
    if (typeof rawStatus === 'string'){
      payload.status = normalizedStatus || ''
    }
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
