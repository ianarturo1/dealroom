import { Buffer } from 'node:buffer'
import { ok, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const numberFields = [
  { key: 'power_kwp', label: 'potencia (kWp)' },
  { key: 'energy_mwh', label: 'energía anual (MWh)' },
  { key: 'co2_tons', label: 'CO₂ evitado (t/año)' }
]

function trimString(value){
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function normalizeSlugValue(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function ensureUniqueSlug(baseSlug, used){
  const safeBase = baseSlug || 'proyecto'
  let candidate = safeBase
  let suffix = 2
  while (used.has(candidate)){
    candidate = `${safeBase}-${suffix}`
    suffix += 1
  }
  return candidate
}

function parseOptionalNumber(project, field, label){
  const id = project.id || `#${project.__index}`
  const raw = trimString(project[field])
  if (!raw){
    return undefined
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
  const location = trimString(working.location)
  const status = trimString(working.status) || 'Disponible'
  const termMonthsRaw = trimString(working.termMonths)
  const empresa = trimString(working.empresa)
  const imageUrl = trimString(working.imageUrl)
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)){
    throw new Error(`Proyecto ${id} tiene Imagen (URL) inválida`)
  }

  const manualSlug = normalizeSlugValue(working.slug)
  const slugFromName = normalizeSlugValue(name)
  const slugFromId = normalizeSlugValue(id)
  const slug = manualSlug || slugFromName || slugFromId || `proyecto-${index + 1}`

  const normalized = { id, slug, name, status }

  if (client) normalized.client = client
  if (location) normalized.location = location

  for (const field of numberFields){
    const value = parseOptionalNumber(working, field.key, field.label)
    if (value !== undefined){
      normalized[field.key] = value
    }
  }

  if (termMonthsRaw){
    const parsedTerm = parseInt(termMonthsRaw, 10)
    if (!Number.isFinite(parsedTerm)){
      throw new Error(`Proyecto ${id} tiene Plazo (meses) inválido`)
    }
    normalized.termMonths = Math.max(0, parsedTerm)
  }

  if (empresa) normalized.empresa = empresa
  if (imageUrl) normalized.imageUrl = imageUrl

  const notes = trimString(working.notes)
  if (notes) normalized.notes = notes

  const loiTemplate = trimString(working.loi_template)
  if (loiTemplate) normalized.loi_template = loiTemplate

  return normalized
}

export default async function handler(event, context){
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
    let existing = []
    try {
      const file = await getFile(repo, path, branch)
      sha = file.sha
      if (file.content){
        const decoded = Buffer.from(file.content, 'base64').toString('utf8')
        const parsed = JSON.parse(decoded || '[]')
        if (Array.isArray(parsed)){
          existing = parsed
        }
      }
    }catch(error){
      const msg = String(error && error.message || '')
      if (!msg.includes('404')){
        throw error
      }
    }

    const incomingSlugSet = new Set(normalized.map(item => item.slug).filter(Boolean))
    const usedSlugs = new Set()
    for (const item of existing){
      const slug = typeof item?.slug === 'string' ? item.slug : ''
      if (slug && !incomingSlugSet.has(slug)){
        usedSlugs.add(slug)
      }
    }

    for (const project of normalized){
      const finalSlug = ensureUniqueSlug(project.slug, usedSlugs)
      usedSlugs.add(finalSlug)
      project.slug = finalSlug
    }

    const contentBase64 = Buffer.from(JSON.stringify(normalized, null, 2)).toString('base64')
    const res = await putFile(repo, path, contentBase64, 'Actualizar proyectos vía Dealroom', sha, branch)

    return ok({ ok: true, count: normalized.length, commit: res.commit && res.commit.sha })
  }catch(err){
    const status = err.statusCode || 500
    return text(status, err.message)
  }
}
