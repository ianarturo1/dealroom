import { Octokit } from 'octokit'
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs'

function requiredEnv(name){
  const v = (process.env[name] || '').trim()
  if (!v){ const e = new Error(`Missing env ${name}`); e.status = 500; throw e }
  return v
}

const OWNER_REPO = requiredEnv('DOCS_REPO')      // "ianarturo1/dealroom"
const BRANCH     = requiredEnv('DOCS_BRANCH')    // "main"
const ROOT       = requiredEnv('DOCS_ROOT_DIR').replace(/^\/+|\/+$/g,'') // "dealroom"

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined })
const gh = octokit.rest ? octokit.rest : octokit // compat

const cleanCat  = s => String(s||'').trim().replace(/^\/+|\/+$/g,'')        // respeta mayúsculas/acentos
const cleanSlug = s => String(s||'').trim().toLowerCase().replace(/^\/+|\/+$/g,'')
const decode = s => decodeURIComponent(String(s||'')).replace(/\+/g,' ').trim()

// Normalizador "tolerante" para comparar nombres
function normName(s){
  return String(s||'')
    .replace(/\+/g,' ')               // plus -> espacio
    .replace(/\s+/g,' ')              // colapsa espacios
    .trim()
}

export default async function handler(request){
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET'])
  const { params } = getUrlAndParams(request)
  const category = cleanCat(decode(params.get('category')))
  const slug     = cleanSlug(decode(params.get('slug')))
  const filenameRaw = decode(params.get('filename'))
  const filename = normName(filenameRaw)

  if (!category || !slug || !filename){
    return json({ ok:false, error:'Missing category, slug or filename' }, 400)
  }

  const [owner, repo] = OWNER_REPO.split('/')
  const baseDir = [ROOT, category, slug].filter(Boolean).join('/')
  const directPath = `${baseDir}/${filename}`

  // 1) Intento directo
  try {
    const res = await gh.repos.getContent({ owner, repo, path: directPath, ref: BRANCH })
    if (res.data?.type === 'file'){
      const dl = res.data.download_url
      if (dl) return new Response(null, { status: 302, headers: { Location: dl } })
      const buf = Buffer.from(res.data.content || '', 'base64')
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      })
    }
  } catch (err){
    // 404 → seguimos al fallback; otros errores, devolvemos
    if (err.status && err.status !== 404){
      return json({ ok:false, error: err.message || String(err), status: err.status, pathTried: directPath }, err.status)
    }
  }

  // 2) Fallback: listar carpeta y buscar por coincidencia tolerante
  try {
    const dir = await gh.repos.getContent({ owner, repo, path: baseDir, ref: BRANCH })
    const items = Array.isArray(dir.data) ? dir.data : []
    // Busca coincidencia exacta y luego normalizada
    let hit = items.find(i => i.type === 'file' && i.name === filename)
    if (!hit){
      hit = items.find(i => i.type === 'file' && normName(i.name) === filename)
    }
    if (!hit){
      return json({ ok:false, error:'File not found', pathDir: baseDir, filename }, 404)
    }
    if (hit.download_url){
      return new Response(null, { status: 302, headers: { Location: hit.download_url } })
    }
    // Si no trae download_url, pide el archivo por path real
    const fileRes = await gh.repos.getContent({ owner, repo, path: hit.path, ref: BRANCH })
    const buf = Buffer.from(fileRes.data.content || '', 'base64')
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${hit.name}"`,
      }
    })
  } catch(err){
    const status = err.status || 500
    return json({ ok:false, error: err.message || String(err), status, pathDir: baseDir }, status)
  }
}
