// netlify/functions/download-file.mjs
import { getGithubRawUrl } from "./lib/storage.js";

const FF = process.env.DOCS_BACKEND_ALSEA === 'on';
function json(statusCode, body){ return { statusCode, headers:{'Access-Control-Allow-Origin':process.env.CORS_ORIGIN||'*','Content-Type':'application/json'}, body: JSON.stringify(body) }; }
function assertFeatureOn(){ if(!FF) throw new Error('Disabled'); }
function assertAlsea(slug){ if((slug||'').toLowerCase()!=='alsea'){ const e=new Error('ForbiddenSlug'); e.code='ForbiddenSlug'; throw e; } }
function assertSafe(value, field='field'){ if(!value){ const e=new Error('MissingParam'); e.code='MissingParam'; e.field=field; throw e; } if(value.length>100){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } const ok=/^[a-zA-Z0-9._-]{1,100}$/.test(value); const bad=/(\.{2})|(\/)|(\\)|(%2e)|(%2f)|(%5c)/i.test(value); if(!ok||bad){ const e=new Error('BadRequest'); e.code='BadRequest'; throw e; } }
function guessMime(ext){ const e=(ext||'').toLowerCase(); if (e==='pdf') return 'application/pdf'; if (['png','jpg','jpeg','gif','webp'].includes(e)) return `image/${e==='jpg'?'jpeg':e}`; if (e==='txt') return 'text/plain'; if (e==='csv') return 'text/csv'; if (['xls','xlsx'].includes(e)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; if (['doc','docx'].includes(e)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; if (e==='zip') return 'application/zip'; return 'application/octet-stream'; }
async function streamToBase64(stream){ const chunks=[]; const reader=stream.getReader(); for(;;){ const {done,value}=await reader.read(); if(done) break; chunks.push(value); } return Buffer.concat(chunks).toString('base64'); }

export const handler = async (event) => {
  try {
    assertFeatureOn();
    if (event.httpMethod !== 'GET') return json(405, { ok:false, code:'MethodNotAllowed' });

    const q = event.queryStringParameters || {};
    const slug = (q.slug||'').toLowerCase();
    const category = (q.category||'').trim();
    const filename = (q.filename||'').trim();
    const disposition = ((q.disposition||'attachment').toLowerCase()==='inline') ? 'inline' : 'attachment';

    assertAlsea(slug);
    assertSafe(slug,'slug'); assertSafe(category,'category'); assertSafe(filename,'filename');

    const path = `data/docs/${slug}/${category}/${filename}`;
    const { downloadUrl, size } = await getGithubRawUrl({ path });

    const ext = filename.split('.').pop();
    const mimetype = guessMime(ext);

    const upstream = await fetch(downloadUrl);
    if (!upstream.ok) return json(404, { ok:false, code:'NotFound' });
    if (size === 0) return json(400, { ok:false, code:'CorruptFile' });

    const bodyBase64 = await streamToBase64(upstream.body);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
        'Content-Type': mimetype,
        ...(size ? { 'Content-Length': String(size) } : {}),
        'Content-Disposition': `${disposition}; filename="${filename}"`,
      },
      body: bodyBase64,
      isBase64Encoded: true,
    };

  } catch (err) {
    const code = err?.code || err?.message || 'DownloadError';
    if (code==='Disabled') return json(503, { ok:false, code:'Disabled' });
    if (code==='ForbiddenSlug') return json(403, { ok:false, code });
    if (code==='MissingParam'||code==='BadRequest') return json(400, { ok:false, code, field: err?.field });
    if (code==='NotFound') return json(404, { ok:false, code });
    if (String(err?.message||'').startsWith('MissingEnv')) return json(500, { ok:false, code:'MissingEnv', msg: err.message });
    return json(500, { ok:false, code:'DownloadError', msg: String(err?.message||err) });
  }
};
