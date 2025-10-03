// netlify/functions/download-file.mjs
import { getGithubRawUrl } from "./lib/storage.js";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return res(405, 'MethodNotAllowed');

    const q = event.queryStringParameters || {};
    const slug = (q.slug || '').toLowerCase();
    const category = (q.category || '').trim();
    const filename = (q.filename || '').trim();
    const disposition = (q.disposition || 'attachment').toLowerCase(); // 'inline' o 'attachment'

    if (!slug) return json(400, { ok:false, code:'MissingParam', param:'slug' });
    if (slug !== 'alsea') return json(403, { ok:false, code:'ForbiddenSlug', msg:'Solo Alsea permitido' });
    if (!category) return json(400, { ok:false, code:'MissingParam', param:'category' });
    if (!filename) return json(400, { ok:false, code:'MissingParam', param:'filename' });

    const path = `data/docs/${slug}/${category}/${filename}`;
    const { downloadUrl, size } = await getGithubRawUrl({ path });

    // Detectar mimetype simple por extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimetype = guessMime(ext);

    // Fetch con streaming (Node 18 fetch nativo)
    const upstream = await fetch(downloadUrl);
    if (!upstream.ok) return json(404, { ok:false, code:'NotFound' });

    const body = upstream.body; // stream

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': mimetype,
        ...(size ? { 'Content-Length': String(size) } : {}),
        'Content-Disposition': `${disposition}; filename="${filename}"`
      },
      body: await streamToBase64(body),
      isBase64Encoded: true
    };
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg === 'NotFound') return json(404, { ok:false, code:'NotFound' });
    if (msg.startsWith('MissingEnv')) return json(500, { ok:false, code:'MissingEnv', msg });
    return json(500, { ok:false, code:'DownloadError', msg });
  }
};

function guessMime(ext) {
  if (ext === 'pdf') return 'application/pdf';
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return `image/${ext==='jpg'?'jpeg':ext}`;
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'json') return 'application/json';
  if (['doc','docx'].includes(ext)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (['xls','xlsx'].includes(ext)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (ext === 'zip') return 'application/zip';
  return 'application/octet-stream';
}

async function streamToBase64(stream) {
  const chunks = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks);
  return buf.toString('base64');
}

function res(statusCode, msg) { return { statusCode, body: msg }; }
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}
