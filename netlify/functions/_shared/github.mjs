import { Buffer } from 'node:buffer'
import { Octokit } from 'octokit'

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
})

export const owner = process.env.DOCS_OWNER || 'finsolar'
export const repo = process.env.DOCS_REPO || 'dealroom'
export const ref = process.env.DOCS_REF || 'main'

export async function listRepoPath(path) {
  const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref })
  return data
}

export async function getFileBuffer(path) {
  const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref })
  if (Array.isArray(data)) {
    throw new Error('Requested path is not a file')
  }

  if (data.download_url) {
    const response = await fetch(data.download_url)
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  const encoding = data.encoding || 'base64'
  return Buffer.from(data.content, encoding)
}

export async function putFileBuffer(path, buffer, message, contentType = 'application/octet-stream') {
  let sha
  try {
    const existing = await octokit.rest.repos.getContent({ owner, repo, path, ref })
    if (!Array.isArray(existing.data)) {
      sha = existing.data.sha
    }
  } catch (error) {
    if (error.status !== 404) throw error
  }

  const base64Content = buffer.toString('base64')

  const endpoint = octokit.request.endpoint('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    message,
    content: base64Content,
    branch: ref,
    ...(sha ? { sha } : {}),
  })

  endpoint.headers = {
    ...endpoint.headers,
    'Content-Type': contentType,
  }

  return octokit.request(endpoint)
}
