import { Buffer } from 'node:buffer'

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {})
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const status = init.status ?? 200
  return new Response(JSON.stringify(data), { ...init, status, headers })
}

export function errorJson(message, status = 500, extra = {}, init = {}) {
  return json({ ok: false, error: message, ...extra }, { ...init, status })
}

export function badRequest(message = 'Bad Request', extra = {}, init = {}) {
  return errorJson(message, 400, extra, init)
}

export function notFound(message = 'Not Found', extra = {}, init = {}) {
  return errorJson(message, 404, extra, init)
}

export function methodNotAllowed(allowed = ['GET'], init = {}) {
  return json({ ok: false, error: 'Method not allowed', allowed }, { ...init, status: 405 })
}

export function binary(body, { filename, contentType = 'application/octet-stream', disposition = 'attachment', status = 200, headers: extraHeaders = {}, ...init } = {}) {
  const headers = new Headers(extraHeaders)
  headers.set('Content-Type', contentType)
  if (filename) headers.set('Content-Disposition', `${disposition}; filename="${filename}"`)
  return new Response(body, { ...init, status, headers })
}

export function getUrlAndParams(request) {
  const url = new URL(request.url)
  return { url, params: url.searchParams }
}

export async function readSingleFileFromFormData(request) {
  const form = await request.formData()
  const file = form.get('file')
  if (!file) return { form, file: null, buffer: null }
  const arrayBuffer = await file.arrayBuffer()
  return { form, file, buffer: Buffer.from(arrayBuffer) }
}
