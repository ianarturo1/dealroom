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

// Deriva slug del path si no viene en el payload.
// Soporta: "<category>/<slug>/<name>"  y  "data/docs/<slug>/<category>/<name>"
function deriveSlugFromPath(rawPath = "", expectedCategory = "") {
  const p = String(rawPath).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p) return "";

  // match: category/slug/name
  const m1 = p.match(/^([^/]+)\/([^/]+)\/[^/]+$/);
  if (m1) {
    const cat = (m1[1] || "").toLowerCase();
    const slug = m1[2] || "";
    // si mandaron category en el body, validamos consistencia
    if (!expectedCategory || cat === expectedCategory.toLowerCase()) {
      return slug;
    }
  }

  // match: data/docs/slug/category/name
  const m2 = p.match(/^data\/docs\/([^/]+)\/([^/]+)\/[^/]+$/);
  if (m2) {
    return m2[1] || "";
  }

  return "";
}

export default async (req) => {
  if (req.method === "OPTIONS") return jsonResponse(200, { ok: true });
  if (req.method !== "POST") return jsonResponse(405, { ok: false, message: "Method not allowed" });

  try {
    const { slug: rawSlug, category: rawCategory, name: rawName, path: rawPath } = await req.json();

    const category = sanitizeSegment(rawCategory || "");
    const name = sanitizeSegment(rawName || "");
    const cleanPath = rawPath ? String(rawPath).replace(/\\/g, "/").replace(/^\/+/, "") : "";

    // Si no vino slug, lo derivamos del path.
    const derivedSlug = !rawSlug ? deriveSlugFromPath(cleanPath, category) : "";
    const slug = ensureSlugAllowed((rawSlug || derivedSlug || "").trim());

    if ((!cleanPath && (!category || !name))) {
      throw httpError(400, "Missing category/name or path");
    }

    const DOCS_REPO = getEnv("DOCS_REPO");
    const DOCS_BRANCH = getEnv("DOCS_BRANCH");
    const token = getEnv("GITHUB_TOKEN");
    const [owner, repo] = DOCS_REPO.split("/");

    const octokit = new Octokit({ auth: token });

    // Candidatos de ruta a borrar (nuevo layout y legacy)
    const candidatePaths = [];
    if (cleanPath) candidatePaths.push(cleanPath);
    if (category && name) candidatePaths.push(`${category}/${slug}/${name}`);
    if (category && name) candidatePaths.push(`data/docs/${slug}/${category}/${name}`);

    let lastError = null;
    for (const p of candidatePaths) {
      try {
        const { data: meta } = await octokit.repos.getContent({
          owner, repo, path: p, ref: DOCS_BRANCH,
        });
        const sha = Array.isArray(meta) ? null : meta.sha;
        if (!sha) continue;

        await octokit.repos.deleteFile({
          owner, repo, path: p,
          message: `chore(docs): delete ${p} via admin`,
          sha, branch: DOCS_BRANCH,
        });

        return jsonResponse(200, { ok: true, path: p });
      } catch (e) {
        lastError = e;
      }
    }

    const msg = (lastError && (lastError.statusText || lastError.message)) || "File not found";
    return jsonResponse(404, { ok: false, message: msg });
  } catch (err) {
    const status = err?.statusCode || err?.status || 500;
    return jsonResponse(status, { ok: false, message: err?.message || "Delete failed" });
  }
};
