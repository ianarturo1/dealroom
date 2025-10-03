// netlify/functions/upload-doc.js
import { putFileGithub } from "./lib/storage.js";
import Busboy from "busboy";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return resp(405, { ok:false, code:'MethodNotAllowed' });

    // Parse multipart
    const contentType = event.headers['content-type'] || event.headers['Content-Type'];
    if (!contentType?.includes('multipart/form-data')) return resp(400, { ok:false, code:'BadRequest', msg:'Expected multipart/form-data' });

    const fields = {};
    let fileBuf = Buffer.alloc(0);
    let filename = '';

    const rawBody = event.body
      ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
      : Buffer.alloc(0)

    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: { 'content-type': contentType } });
      bb.on('field', (name, val) => fields[name] = String(val || '').trim());
      bb.on('file', (_name, stream, info) => {
        filename = info?.filename || '';
        stream.on('data', d => fileBuf = Buffer.concat([fileBuf, d]));
      });
      bb.on('finish', resolve);
      bb.on('error', reject);
      bb.end(rawBody);
    });

    // Validaciones claras
    const slug = (fields.slug || '').toLowerCase();
    const category = (fields.category || '').trim();
    const explicitFilename = (fields.filename || '').trim() || filename;

    if (!slug) return resp(400, { ok:false, code:'MissingField', field:'slug' });
    if (slug !== 'alsea') return resp(403, { ok:false, code:'ForbiddenSlug', msg:'Solo Alsea permitido' });
    if (!category) return resp(400, { ok:false, code:'MissingField', field:'category' });
    if (!explicitFilename) return resp(400, { ok:false, code:'MissingField', field:'filename' });
    if (hasTraversal(category) || hasTraversal(explicitFilename)) {
      return resp(400, { ok:false, code:'InvalidPath', msg:'Nombre de archivo o categoría inválido' });
    }
    if (!fileBuf.length) return resp(400, { ok:false, code:'MissingFile' });

    // Limite práctico de GitHub (evitar base64 gigante)
    const maxBytes = 25 * 1024 * 1024;
    if (fileBuf.length > maxBytes) return resp(413, { ok:false, code:'FILE_TOO_LARGE_FOR_GITHUB', msg:'Usar almacenamiento alterno (Drive/S3)' });

    const path = `data/docs/${slug}/${category}/${explicitFilename}`;
    const contentBase64 = fileBuf.toString('base64');
    const decodedLength = Buffer.from(contentBase64, 'base64').length;
    if (decodedLength !== fileBuf.length) {
      console.error('upload-doc.js:base64-mismatch', { path, fileBytes: fileBuf.length, decodedLength });
      return resp(500, { ok:false, code:'Base64EncodingError', msg:'No se pudo preparar el archivo para subirlo' });
    }

    console.debug('upload-doc.js:ready-to-upload', { path, bytes: fileBuf.length });

    const out = await putFileGithub({ path, contentBase64, message:`Upload: ${slug}/${category}/${explicitFilename}` });
    if (!out?.commitSha) {
      console.error('upload-doc.js:missing-commit', { path, response: out });
      return resp(502, { ok:false, code:'UploadVerificationFailed', msg:'No se pudo confirmar el guardado en GitHub' });
    }

    console.debug('upload-doc.js:uploaded', { path, bytes: fileBuf.length, commitSha: out.commitSha });
    return resp(200, { ok:true, provider:'github', path, ...out });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.startsWith('MissingEnv')) return resp(500, { ok:false, code:'MissingEnv', msg });
    if (msg === 'NotFound') return resp(404, { ok:false, code:'NotFound' });
    return resp(500, { ok:false, code:'UploadError', msg });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function hasTraversal(value = '') {
  if (/[\\/]/.test(value)) return true;
  if (value === '..') return true;
  if (value.startsWith('../') || value.startsWith('..\\')) return true;
  return false;
}
