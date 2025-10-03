// netlify/functions/upload-doc.mjs
import { putFileGithub } from "./lib/storage.mjs";
import { readSingleFileFromFormData, json } from './_shared/http.mjs';

const FF = process.env.DOCS_BACKEND_ALSEA === 'on';
const corsHeaders = () => ({ 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'});
function assertFeatureOn(){ if(!FF) throw new Error('Disabled'); }
function assertAlsea(slug){ if((slug||'').toLowerCase()!=='alsea'){ const e=new Error('ForbiddenSlug'); e.code='ForbiddenSlug'; throw e; } }
function assertSafe(value, field='field'){ if(!value){ const e=new Error('MissingField'); e.code='MissingField'; e.field=field; throw e; } if(value.length>100){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } const ok=/^[a-zA-Z0-9._-]{1,100}$/.test(value); const bad=/(\.{2})|(\/)|(\\)|(%2e)|(%2f)|(%5c)/i.test(value); if(!ok||bad){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } }

export default async function handler(request, context) {
  try {
    assertFeatureOn();
    if (request.method !== 'POST') return json({ ok:false, code:'MethodNotAllowed' }, { status: 405, headers: corsHeaders() });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) return json({ ok:false, code:'BadRequest', msg:'Expected multipart/form-data' }, { status: 400, headers: corsHeaders() });

    const { form, file, buffer } = await readSingleFileFromFormData(request);

    const slug = String(form.get('slug') || '').toLowerCase();
    const category = String(form.get('category') || '').trim();
    const filename = String(form.get('filename') || file?.name || '').trim();

    assertAlsea(slug);
    assertSafe(slug,'slug'); assertSafe(category,'category'); assertSafe(filename,'filename');

    if (!buffer || !buffer.length) return json({ ok:false, code:'EmptyFile' }, { status: 400, headers: corsHeaders() });
    const maxBytes = 25 * 1024 * 1024;
    if (buffer.length > maxBytes) return json({ ok:false, code:'FILE_TOO_LARGE_FOR_GITHUB', msg:'Use almacenamiento alterno' }, { status: 413, headers: corsHeaders() });

    const path = `data/docs/${slug}/${category}/${filename}`;
    const contentBase64 = buffer.toString('base64');

    const out = await putFileGithub({ path, contentBase64, message:`Upload: ${slug}/${category}/${filename}` });
    return json({ ok:true, provider:'github', path, ...out }, { headers: corsHeaders() });

  } catch (err) {
    const code = err?.code || err?.message || 'UploadError';
    if (code==='Disabled') return json({ ok:false, code:'Disabled' }, { status: 503, headers: corsHeaders() });
    if (code==='ForbiddenSlug') return json({ ok:false, code }, { status: 403, headers: corsHeaders() });
    if (code==='MissingField'||code==='BadRequest') return json({ ok:false, code, field: err?.field }, { status: 400, headers: corsHeaders() });
    if (String(err?.message||'').startsWith('MissingEnv')) return json({ ok:false, code:'MissingEnv', msg: err.message }, { status: 500, headers: corsHeaders() });
    return json({ ok:false, code:'UploadError', msg: String(err?.message||err) }, { status: 500, headers: corsHeaders() });
  }
}
