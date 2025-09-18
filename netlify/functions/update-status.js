import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

export async function handler(event){
  try{
    const body = JSON.parse(event.body || '{}')
    if (!body.id) return text(400, 'Falta id (slug) de inversionista')

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return text(500, 'CONTENT_REPO/GITHUB_TOKEN no configurados')
    }
    const path = `data/investors/${body.id}.json`

    let sha = undefined
    try {
      const f = await getFile(repo, path, branch)
      sha = f.sha
    }catch(_){ /* new file */ }

    const contentBase64 = Buffer.from(JSON.stringify(body, null, 2)).toString('base64')
    const res = await putFile(repo, path, contentBase64, `Update investor ${body.id} via Dealroom`, sha, branch)
    return ok({ ok:true, commit: res.commit && res.commit.sha })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
