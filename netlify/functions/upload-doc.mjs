import { json, text } from './_lib/utils.mjs'
import { repoEnv, getFile, putFile } from './_lib/github.mjs'

const publicInvestorId = () => {
  const raw = typeof process.env.PUBLIC_INVESTOR_SLUG === 'string'
    ? process.env.PUBLIC_INVESTOR_SLUG.trim().toLowerCase()
    : ''
  return raw || 'femsa'
}

const formatTimestamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
}

const isGitHubNotFound = (error) => {
  const message = String(error && error.message ? error.message : error)
  return message.includes('GitHub 404')
}

export async function handler(event){
  try{
    if (event.httpMethod && event.httpMethod !== 'POST'){
      return text(405, 'Method not allowed')
    }

    const repo = repoEnv('DOCS_REPO', '')
    const branch = process.env.DOCS_BRANCH || 'main'
    const token = process.env.GITHUB_TOKEN
    if (!repo || !token){
      return text(500, 'DOCS_REPO/GITHUB_TOKEN no configurados')
    }

    const body = JSON.parse(event.body || '{}')
    const category = (body.path || '').toString().trim().replace(/^\/+|\/+$/g, '')
    const fileName = (body.filename || '').toString().trim()
    const contentBase64 = (body.contentBase64 || '').toString().trim()
    const investorInput = typeof body.investor === 'string'
      ? body.investor.trim().toLowerCase()
      : (typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '')
    const investorId = investorInput || publicInvestorId()
    const strategy = typeof body.strategy === 'string' ? body.strategy : undefined

    if (!category || !fileName || !contentBase64){
      return text(400, 'Faltan datos (path, filename, contentBase64)')
    }

    const originalPath = `${category}/${investorId}/${fileName}`
    let existing = null
    try {
      existing = await getFile(repo, originalPath, branch)
    } catch (error) {
      if (!isGitHubNotFound(error)) throw error
    }

    if (existing && strategy !== 'rename'){
      return json(409, {
        error: 'FILE_EXISTS',
        message: 'File already exists in that category',
        path: originalPath
      })
    }

    let finalPath = originalPath
    let finalFileName = fileName
    let renamed = false

    if (existing && strategy === 'rename'){
      const dotIndex = fileName.lastIndexOf('.')
      const base = dotIndex > -1 ? fileName.slice(0, dotIndex) : fileName
      const ext = dotIndex > -1 ? fileName.slice(dotIndex) : ''
      finalFileName = `${base}_${formatTimestamp()}${ext}`
      finalPath = `${category}/${investorId}/${finalFileName}`
      renamed = true
    }

    if (renamed){
      try {
        const renamedExisting = await getFile(repo, finalPath, branch)
        if (renamedExisting){
          return json(409, {
            error: 'FILE_EXISTS',
            message: 'File already exists in that category',
            path: finalPath
          })
        }
      } catch (error) {
        if (!isGitHubNotFound(error)) throw error
      }
    }

    const commitMessageSuffix = renamed ? ' (auto-rename)' : ''
    const commitMessage = `docs(${investorId}): upload ${category}/${finalFileName}${commitMessageSuffix}`

    await putFile(repo, finalPath, contentBase64, commitMessage, undefined, branch)

    return json(200, {
      ok: true,
      path: finalPath,
      renamed,
      fileName: finalFileName
    })
  }catch(error){
    const status = error.statusCode || 500
    const message = String(error && error.message ? error.message : error)
    if (status === 409){
      return json(409, {
        error: 'FILE_EXISTS',
        message,
        path: error.path || ''
      })
    }
    return text(status, message)
  }
}
