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
    if (hasTraversal(category) || hasTraversal(filename)) {
      return json(400, { ok:false, code:'InvalidPath', msg:'Nombre de archivo o categoría inválido' });
    }

    const path = `data/docs/${slug}/${category}/${filename}`;
    const { downloadUrl, size } = await getGithubRawUrl({ path });
    if (!size || Number(size) <= 0) {
      console.error('download-file.mjs:github-empty', { path, reportedSize: size });
      return json(502, { ok:false, code:'EmptyFile', msg:'El archivo no tiene contenido' });
    }

    console.debug('download-file.mjs:github-metadata', { path, size });

    // Detectar mimetype simple por extensión
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimetype = guessMime(ext);

    // Fetch con streaming (Node 18 fetch nativo)
    const upstream = await fetch(downloadUrl);
    if (!upstream.ok) return json(404, { ok:false, code:'NotFound' });

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (!buffer.length) {
      console.error('download-file.mjs:empty-buffer', { path, size });
      return json(502, { ok:false, code:'EmptyFile', msg:'El archivo está vacío o corrupto' });
    }
    if (typeof size === 'number' && size > 0 && buffer.length !== size) {
      console.error('download-file.mjs:size-mismatch', { path, reported: size, received: buffer.length });
      return json(502, { ok:false, code:'SizeMismatch', msg:'El archivo no coincide con la metadata del repositorio' });
    }

    console.debug('download-file.mjs:fetched', { path, size, bufferBytes: buffer.length });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': mimetype,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `${disposition}; filename="${filename}"`
      },
      body: buffer.toString('base64'),
      isBase64Encoded: true
    };
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg === 'NotFound') return json(404, { ok:false, code:'NotFound' });
    if (msg === 'InvalidMetadata') return json(502, { ok:false, code:'InvalidMetadata', msg:'Metadata inválida en almacenamiento' });
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

function res(statusCode, msg) { return { statusCode, body: msg }; }
function json(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}

function hasTraversal(value = '') {
  if (/[\\/]/.test(value)) return true;
  if (value === '..') return true;
  if (value.startsWith('../') || value.startsWith('..\\')) return true;
  return false;
}
