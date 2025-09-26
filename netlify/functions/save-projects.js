import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const numberFields = [
  { key: 'power_kwp', label: 'potencia (kWp)' },
  { key: 'energy_mwh', label: 'energía anual (MWh)' },
  { key: 'co2_tons', label: 'CO₂ evitado (t/año)' }
]

function parseTermMonths(value){
  if (typeof value === 'number' && Number.isFinite(value)){
    return Math.max(0, Math.round(value))
  }
  const raw = trimString(value)
  if (!raw) return 0
  const parsed = parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return 0
  return Math.max(0, parsed)
}

function trimString(value){
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function requireNumber(project, field, label){
  const id = project.id || `#${project.__index}`
  const raw = trimString(project[field])
  if (!raw){
    throw new Error(`Proyecto ${id} requiere ${label}`)
  }
  const num = Number(raw)
  if (!Number.isFinite(num)){
    throw new Error(`Proyecto ${id} tiene ${label} inválido`)
  }
  return num
}

function normalizeProject(project, index){
  if (!project || typeof project !== 'object'){
    throw new Error(`Proyecto en posición ${index + 1} inválido`)
  }

  const working = { ...project, __index: index + 1 }
  const id = trimString(working.id)
  if (!id) throw new Error(`Proyecto ${index + 1} requiere un id`)
  const name = trimString(working.name)
  if (!name) throw new Error(`Proyecto ${id} requiere nombre`)
  const client = trimString(working.client)
  if (!client) throw new Error(`Proyecto ${id} requiere cliente`)
  const location = trimString(working.location)
  if (!location) throw new Error(`Proyecto ${id} requiere ubicación`)
  const model = trimString(working.model)
  if (!model) throw new Error(`Proyecto ${id} requiere modelo`)
  const status = trimString(working.status) || 'Disponible'
  const termMonths = parseTermMonths(working.termMonths)
  const empresa = trimString(working.empresa)
  const imageUrl = trimString(working.imageUrl)
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)){
    throw new Error(`Proyecto ${id} tiene Imagen (URL) inválida`)
  }

  const normalized = {
    id,
    name,
    client,
    location,
    model,
    status,
    termMonths,
    empresa,
    imageUrl
  }

  for (const field of numberFields){
    normalized[field.key] = requireNumber(working, field.key, field.label)
  }

  const notes = trimString(working.notes)
  if (notes) normalized.notes = notes

  const loiTemplate = trimString(working.loi_template)
  if (loiTemplate) normalized.loi_template = loiTemplate

  return normalized
}

export async function handler(event){
  try{
    const body = JSON.parse(event.body || '{}')
    const list = body.projects
    if (!Array.isArray(list)) return text(400, '"projects" debe ser un arreglo')

    const normalized = list.map((item, index) => normalizeProject(item, index))

    const ids = new Set()
    for (const project of normalized){
      if (ids.has(project.id)){
        return text(400, `ID duplicado: ${project.id}`)
      }
      ids.add(project.id)
    }

    const repo = repoEnv('CONTENT_REPO', '')
    const branch = process.env.CONTENT_BRANCH || 'main'
    if (!repo || !process.env.GITHUB_TOKEN){
      return text(500, 'CONTENT_REPO/GITHUB_TOKEN no configurados')
    }

    const path = 'data/projects.json'
    let sha
    try {
      const file = await getFile(repo, path, branch)
      sha = file.sha
    }catch(error){
      const msg = String(error && error.message || '')
      if (!msg.includes('404')){
        throw error
      }
    }

    const contentBase64 = Buffer.from(JSON.stringify(normalized, null, 2)).toString('base64')
    const res = await putFile(repo, path, contentBase64, 'Actualizar proyectos vía Dealroom', sha, branch)

    return ok({ ok: true, count: normalized.length, commit: res.commit && res.commit.sha })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
