// netlify/functions/download-file.mjs
import { getGithubFileBinary } from "./lib/storage.mjs";
import { json, binary } from './_shared/http.mjs';

const corsHeaders = () => ({ 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*' });

export default async function handler(request, context) {
  // ...validaciones/slug/disposition/etc...

  const path = `data/docs/${slug}/${category}/${filename}`;

  // Antes: const { downloadUrl, size } = await getGithubRawUrl({ path });
  // Ahora:
  const { buffer, size } = await getGithubFileBinary({ path });

  if (!buffer?.length) return json({ ok:false, code:'CorruptFile' }, { status: 400, headers: corsHeaders() });

  return binary(buffer, {
    filename,
    contentType: mimetype,
    disposition,
    headers: {
      ...corsHeaders(),
      ...(size ? { 'Content-Length': String(size) } : {})
    }
  });
}
