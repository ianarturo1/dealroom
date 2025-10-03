// netlify/functions/upload-doc.mjs
import Busboy from "busboy";
import { putFileGithub } from "./lib/storage.js";

const FF = process.env.DOCS_BACKEND_ALSEA === 'on';
function json(statusCode, body){ return { statusCode, headers:{'Access-Control-Allow-Origin':process.env.CORS_ORIGIN||'*','Content-Type':'application/json'}, body: JSON.stringify(body) }; }
function assertFeatureOn(){ if(!FF) throw new Error('Disabled'); }
function assertAlsea(slug){ if((slug||'').toLowerCase()!=='alsea'){ const e=new Error('ForbiddenSlug'); e.code='ForbiddenSlug'; throw e; } }
function assertSafe(value, field='field'){ if(!value){ const e=new Error('MissingField'); e.code='MissingField'; e.field=field; throw e; } if(value.length>100){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } const ok=/^[a-zA-Z0-9._-]{1,100}$/.test(value); const bad=/(\.{2})|(\/)|(\\)|(%2e)|(%2f)|(%5c)/i.test(value); if(!ok||bad){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } }

export const handler = async (event) => {
  try {
    assertFeatureOn();
    if (event.httpMethod !== 'POST') return json(405, { ok:false, code:'MethodNotAllowed' });

    const ct = event.headers['content-type']||event.headers['Content-Type']||'';
    if (!ct.includes('multipart/form-data')) return json(400, { ok:false, code:'BadRequest', msg:'Expected multipart/form-data' });

    const fields = {}; let fileBuf = Buffer.alloc(0); let originalName = '';
    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: { 'content-type': ct } });
      bb.on('field', (name, val) => fields[name] = String(val||'').trim());
      bb.on('file', (_name, stream, info) => {
        originalName = info?.filename || '';
        stream.on('data', d => fileBuf = Buffer.concat([fileBuf, d]));
      });
      bb.on('finish', resolve);
      bb.on('error', reject);
      bb.end(Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'));
    });

    const slug = (fields.slug||'').toLowerCase();
    const category = (fields.category||'').trim();
    const filename = (fields.filename||originalName||'').trim();

    assertAlsea(slug);
    assertSafe(slug,'slug'); assertSafe(category,'category'); assertSafe(filename,'filename');

    if (!fileBuf.length) return json(400, { ok:false, code:'EmptyFile' });
    const maxBytes = 25 * 1024 * 1024;
    if (fileBuf.length > maxBytes) return json(413, { ok:false, code:'FILE_TOO_LARGE_FOR_GITHUB', msg:'Use almacenamiento alterno' });

    const path = `data/docs/${slug}/${category}/${filename}`;
    const contentBase64 = fileBuf.toString('base64');

    const out = await putFileGithub({ path, contentBase64, message:`Upload: ${slug}/${category}/${filename}` });
    return json(200, { ok:true, provider:'github', path, ...out });

  } catch (err) {
    const code = err?.code || err?.message || 'UploadError';
    if (code==='Disabled') return json(503, { ok:false, code:'Disabled' });
    if (code==='ForbiddenSlug') return json(403, { ok:false, code });
    if (code==='MissingField'||code==='BadRequest') return json(400, { ok:false, code, field: err?.field });
    if (String(err?.message||'').startsWith('MissingEnv')) return json(500, { ok:false, code:'MissingEnv', msg: err.message });
    return json(500, { ok:false, code:'UploadError', msg: String(err?.message||err) });
  }
};
