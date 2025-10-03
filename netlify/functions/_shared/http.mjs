import { Buffer } from 'node:buffer'

export function json(data, init = {}) {
  const status = init.status ?? 200;
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorJson(message, status = 500, extra = {}) {
  return json({ ok: false, error: message, ...extra }, { status });
}

export function badRequest(message = 'Bad Request', extra = {}) {
  return errorJson(message, 400, extra);
}

export function notFound(message = 'Not Found', extra = {}) {
  return errorJson(message, 404, extra);
}

export function methodNotAllowed(allowed = ['GET']) {
  return json({ ok: false, error: 'Method not allowed', allowed }, { status: 405 });
}

export function binary(body, { filename, contentType = 'application/octet-stream', disposition = 'attachment', status = 200, headers: extraHeaders = {} } = {}) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', contentType);
  if (filename) headers.set('Content-Disposition', `${disposition}; filename="${filename}"`);
  return new Response(body, { status, headers });
}

export function getUrlAndParams(request) {
  const url = new URL(request.url);
  return { url, params: url.searchParams };
}

export async function readSingleFileFromFormData(request) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file) return { form, file: null, buffer: null };
  const arrayBuffer = await file.arrayBuffer();
  return { form, file, buffer: Buffer.from(arrayBuffer) };
}

export function base64ToBuffer(b64) {
  return Buffer.from(b64, 'base64');
}
