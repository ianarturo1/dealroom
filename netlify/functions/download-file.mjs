// netlify/functions/download-file.mjs
import { getGithubFileBinary } from "./lib/storage.mjs";

export default async function handler(event, context) {
  // ...validaciones/slug/disposition/etc...

  const path = `data/docs/${slug}/${category}/${filename}`;

  // Antes: const { downloadUrl, size } = await getGithubRawUrl({ path });
  // Ahora:
  const { buffer, size } = await getGithubFileBinary({ path });

  if (!buffer?.length) return json(400, { ok:false, code:'CorruptFile' });

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Content-Type': mimetype,
      ...(size ? { 'Content-Length': String(size) } : {}),
      'Content-Disposition': `${disposition}; filename="${filename}"`
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
}
