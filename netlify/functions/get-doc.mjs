// netlify/functions/get-doc.mjs
import { getGithubFileBinary } from "./lib/storage.mjs";
import { json, binary, getUrlAndParams } from './_shared/http.mjs';

const FF = process.env.DOCS_BACKEND_ALSEA === "on";

const SAFE = /^[\p{L}\p{N}._\-\s()&+,]{1,160}$/u;
const BAD = /(\.\.)|(\/)|(\\)|(%2e)|(%2f)|(%5c)/i;

function safe(v, field) {
  const s = String(v || "").trim();
  if (!s) throw Object.assign(new Error("MissingParam"), { code: "MissingParam", field });
  if (s.length > 160) throw Object.assign(new Error("BadRequest"), { code: "BadRequest", field });
  if (!SAFE.test(s) || BAD.test(s)) throw Object.assign(new Error("BadRequest"), { code: "BadRequest", field });
  return s;
}
function guess(ext) {
  const e = (ext || "").toLowerCase();
  if (e === "pdf") return "application/pdf";
  if (["png","jpg","jpeg","gif","webp"].includes(e)) return `image/${e==="jpg"?"jpeg":e}`;
  if (e === "txt") return "text/plain";
  if (e === "csv") return "text/csv";
  if (["xls","xlsx"].includes(e)) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (["doc","docx"].includes(e)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (e === "zip") return "application/zip";
  return "application/octet-stream";
}

export default async function handler(request, context) {
  try {
    if (request.method !== "GET") return json({ ok:false, code:"MethodNotAllowed" }, { status: 405 });

    const { params } = getUrlAndParams(request);
    const slug = safe((params.get("slug") || "").toLowerCase(), "slug");
    const category = safe(params.get("category"), "category");
    const filename = safe(params.get("filename"), "filename");

    // Aislar Alsea si está activado el flag
    if (FF && slug !== "alsea") return json({ ok:false, code:"ForbiddenSlug" }, { status: 403 });

    // Content disposition (por compat: default attachment)
    const disposition = (((params.get("disposition") || "attachment").toLowerCase()) === "inline") ? "inline" : "attachment";

    // 1) Intentar path NUEVO (Dealroom unificado)
    let buffer, size;
    let path = `data/docs/${slug}/${category}/${filename}`;
    try {
      ({ buffer, size } = await getGithubFileBinary({ path }));
    } catch (e) {
      // 2) Fallback a path LEGACY (por si tu UI vieja aún lo usa)
      if (String(e?.message) !== "NotFound" && e?.status !== 404) throw e;
      const legacyPath = `${category}/${slug}/${filename}`;
      ({ buffer, size } = await getGithubFileBinary({ path: legacyPath }));
      path = legacyPath;
    }

    if (!buffer?.length) return json({ ok:false, code:"CorruptFile" }, { status: 400 });

    const ext = filename.split(".").pop();
    const mimetype = guess(ext);

    return binary(buffer, {
      filename,
      contentType: mimetype,
      disposition,
      headers: {
        "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
        ...(size ? { "Content-Length": String(size) } : {})
      }
    });

  } catch (err) {
    const code = err?.code || err?.statusCode || err?.status || err?.message || "DownloadError";
    if (code === "MissingParam" || code === "BadRequest") return json({ ok:false, code, field: err?.field }, { status: 400 });
    if (code === 404 || code === "NotFound") return json({ ok:false, code:"NotFound" }, { status: 404 });
    if (String(err?.message || "").startsWith("MissingEnv")) return json({ ok:false, code:"MissingEnv", msg: err.message }, { status: 500 });
    return json({ ok:false, code:"DownloadError", msg: String(err?.message || err) }, { status: 500 });
  }
}
