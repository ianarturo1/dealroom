// netlify/functions/get-doc.mjs
import { getGithubFileBinary } from "./lib/storage.mjs";

const FF = process.env.DOCS_BACKEND_ALSEA === "on";

const SAFE = /^[\p{L}\p{N}._\-\s()&+,]{1,160}$/u;
const BAD = /(\.\.)|(\/)|(\\)|(%2e)|(%2f)|(%5c)/i;

function json(code, obj) {
  return {
    statusCode: code,
    headers: {
      "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(obj)
  };
}
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

export default async function handler(event, context) {
  try {
    if (event.httpMethod !== "GET") return json(405, { ok:false, code:"MethodNotAllowed" });

    const q = event.queryStringParameters || {};
    const slug = safe((q.slug || "").toLowerCase(), "slug");
    const category = safe(q.category, "category");
    const filename = safe(q.filename, "filename");

    // Aislar Alsea si está activado el flag
    if (FF && slug !== "alsea") return json(403, { ok:false, code:"ForbiddenSlug" });

    // Content disposition (por compat: default attachment)
    const disposition = ((q.disposition || "attachment").toLowerCase() === "inline") ? "inline" : "attachment";

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

    if (!buffer?.length) return json(400, { ok:false, code:"CorruptFile" });

    const ext = filename.split(".").pop();
    const mimetype = guess(ext);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": process.env.CORS_ORIGIN || "*",
        "Content-Type": mimetype,
        ...(size ? { "Content-Length": String(size) } : {}),
        "Content-Disposition": `${disposition}; filename="${filename}"`
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true
    };

  } catch (err) {
    const code = err?.code || err?.statusCode || err?.status || err?.message || "DownloadError";
    if (code === "MissingParam" || code === "BadRequest") return json(400, { ok:false, code, field: err?.field });
    if (code === 404 || code === "NotFound") return json(404, { ok:false, code:"NotFound" });
    if (String(err?.message || "").startsWith("MissingEnv")) return json(500, { ok:false, code:"MissingEnv", msg: err.message });
    return json(500, { ok:false, code:"DownloadError", msg: String(err?.message || err) });
  }
}
