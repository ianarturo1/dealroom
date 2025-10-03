import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile, deleteFile, listDir } from './_lib/github.mjs'

const INDEX_PATH = 'data/investor-index.json'

function normalizeSlug(value){
  return (value || '').trim().toLowerCase()
}

function parseIndex(contentBase64){
  try{
    const raw = Buffer.from(contentBase64, 'base64').toString('utf8')
    const json = JSON.parse(raw)
    return { json, raw }
  }catch(_){
    return { json: { investors: {}, domains: {} }, raw: '' }
  }
}

async function deleteDocsDirectory(repo, slug, branch){
  const basePath = `data/docs/${slug}`
  await deleteDirectoryRecursive(repo, basePath, branch)
}

async function deleteDirectoryRecursive(repo, path, branch){
  let entries
  try{
    entries = await listDir(repo, path, branch)
  }catch(error){
    const message = String(error?.message || '')
    if (message.includes('GitHub 404')) return
    throw error
  }
  if (!Array.isArray(entries)){
    if (entries && entries.type === 'file'){
      const filePath = entries.path || path
      await deleteFile(repo, filePath, `Delete ${filePath} via Dealroom`, entries.sha, branch)
    }
    return
  }
  if (entries.length === 0) return
  for (const entry of entries){
    if (entry.type === 'dir'){
      await deleteDirectoryRecursive(repo, entry.path || `${path}/${entry.name}`, branch)
    }else if (entry.type === 'file'){
      const filePath = entry.path || `${path}/${entry.name}`
      await deleteFile(repo, filePath, `Delete ${filePath} via Dealroom`, entry.sha, branch)
    }
  }
}

export default async function handler(event, context){
  if (event.httpMethod !== 'POST'){
    return text(405, 'Method not allowed')
  }

  try{
    const body = JSON.parse(event.body || '{}')
    const slug = normalizeSlug(body.slug)
    if (!slug){
      return text(400, 'Falta slug de inversionista')
    }

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return text(500, 'CONTENT_REPO/GITHUB_TOKEN no configurados')
    }

    const investorPath = `data/investors/${slug}.json`
    let investorFile
    try{
      investorFile = await getFile(repo, investorPath, branch)
    }catch(_){
      return text(404, 'Inversionista no encontrado')
    }

    let indexFile
    try{
      indexFile = await getFile(repo, INDEX_PATH, branch)
    }catch(_){
      return text(500, 'No se pudo obtener investor-index.json')
    }

    const { json: indexJson, raw: originalIndexContent } = parseIndex(indexFile.content)
    if (!indexJson.investors || typeof indexJson.investors !== 'object'){
      indexJson.investors = {}
    }
    if (!indexJson.domains || typeof indexJson.domains !== 'object'){
      indexJson.domains = {}
    }

    delete indexJson.investors[slug]
    for (const domain of Object.keys(indexJson.domains)){
      if (indexJson.domains[domain] === slug){
        delete indexJson.domains[domain]
      }
    }

    await deleteDocsDirectory(repo, slug, branch)

    const updatedIndexContent = JSON.stringify(indexJson, null, 2)
    if (updatedIndexContent !== originalIndexContent){
      const base64 = Buffer.from(updatedIndexContent).toString('base64')
      await putFile(repo, INDEX_PATH, base64, `Update investor index removing ${slug}`, indexFile.sha, branch)
    }

    await deleteFile(repo, investorPath, `Delete investor ${slug} via Dealroom`, investorFile.sha, branch)

    return ok({ ok: true })
  }catch(error){
    const status = error.statusCode || 500
    return text(status, error.message)
  }
}
