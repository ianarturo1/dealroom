// netlify/functions/delete-doc.mjs
import { Octokit } from "octokit";
import { ensureSlugAllowed, httpError, sanitizeSegment } from "./_shared/ensureSlugAllowed.mjs";

function getEnv(name, required = true) {
  const v = process.env[name];
  if (required && (!v || !v.trim())) throw new Error(`Missing env ${name}`);
  return v;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
    },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method not allowed" });
  }

  try {
    const { slug: rawSlug, category: rawCategory, name: rawName, path: rawPath } = await req.json();

    const slug = ensureSlugAllowed(rawSlug || "");
    const category = sanitizeSegment(rawCategory || "");
    const name = sanitizeSegment(rawName || "");

    if ((!rawPath || !rawPath.trim()) && (!category || !name)) {
      throw httpError(400, "Missing category/name or path");
    }

    const DOCS_REPO = getEnv("DOCS_REPO");
    const DOCS_BRANCH = getEnv("DOCS_BRANCH");
    const token = getEnv("GITHUB_TOKEN");

    const octokit = new Octokit({ auth: token });

    // Determinar posibles rutas (nuevo esquema y legacy)
    const normalizedPathFromParts = category && name ? `${category}/${slug}/${name}` : null;

    const candidatePaths = [];
    if (rawPath && rawPath.trim()) {
      // Si el frontend envió un path, normalizamos separadores y limpiamos
      const clean = String(rawPath).replace(/\\/g, "/").replace(/^\/+/, "");
      candidatePaths.push(clean);
    }
    if (normalizedPathFromParts) {
      candidatePaths.push(normalizedPathFromParts);
    }
    // Ruta legacy
    if (category && name) {
      candidatePaths.push(`data/docs/${slug}/${category}/${name}`);
    }

    // Intentar encontrar SHA y borrar en el primer path existente
    let deleted = false;
    let lastError = null;

    for (const p of candidatePaths) {
      try {
        // 1) Obtener SHA del archivo
        const { data: meta } = await octokit.repos.getContent({
          repo: DOCS_REPO.split("/")[1],
          owner: DOCS_REPO.split("/")[0],
          path: p,
          ref: DOCS_BRANCH,
        });

        const sha = Array.isArray(meta) ? null : meta.sha;
        if (!sha) throw httpError(404, "File not found");

        // 2) Borrar
        await octokit.repos.deleteFile({
          repo: DOCS_REPO.split("/")[1],
          owner: DOCS_REPO.split("/")[0],
          path: p,
          message: `chore(docs): delete ${p} via admin`,
          sha,
          branch: DOCS_BRANCH,
        });

        deleted = true;
        return jsonResponse(200, { ok: true, path: p });
      } catch (e) {
        lastError = e;
        // si no existe en este path, probamos el siguiente
      }
    }

    if (!deleted) {
      const msg =
        (lastError && (lastError.statusText || lastError.message)) || "File not found";
      return jsonResponse(404, { ok: false, message: msg });
    }
  } catch (err) {
    const status = err?.statusCode || err?.status || 500;
    return jsonResponse(status, { ok: false, message: err.message || "Delete failed" });
  }
};
