// netlify/functions/update-status.mjs
import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, commitFile } from './_lib/github.mjs'

const ALLOWED_STATUS = [
  'LOI',
  'Revisión de contrato',
  'Presentación de propuesta',
  'Firma',
  // agrega todas tus etapas reales aquí
]

export async function handler(event){
  try {
    if (event.httpMethod !== 'POST') return text(405, 'Method not allowed')

    const body = JSON.parse(event.body || '{}')
    const slugRaw = body.id ?? body.slug ?? ''
    const newStatusRaw = body.status ?? ''

    const slug = String(slugRaw).trim().toLowerCase()            // ← quita espacios
    const newStatus = String(newStatusRaw).trim()

    if (!slug) return text(400, 'Missing slug/id')
    if (!ALLOWED_STATUS.includes(newStatus)) {
      return text(400, `Invalid status: ${newStatus}`)
    }

    const contentRepo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    const path = `data/investors/${slug}.json`

    // 1) Leer el existente
    const file = await getFile(contentRepo, path, branch)
    const existing = JSON.parse(Buffer.from(file.content, file.encoding || 'base64').toString('utf-8'))

    // 2) Merge no destructivo (solo actualiza status y deja lo demás igual)
    const updated = {
      ...existing,
      id: slug,                 // normalizado
      status: newStatus,
    }

    // 3) Commit bonito
    const contentStr = JSON.stringify(updated, null, 2)
    await commitFile({
      repo: contentRepo,
      path,
      branch,
      content: contentStr,
      message: `chore(investor): update status ${slug} -> ${newStatus}`
    })

    return ok({ ok: true, slug, status: newStatus })
  } catch (err) {
    return text(500, err.message)
  }
}

