// netlify/functions/upload-doc.mjs
import { Buffer } from "node:buffer";
import { Octokit } from "octokit";

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function reqJson(event) {
  try { return JSON.parse(event.body || "{}"); } catch { return {}; }
}

function getEnv(name, required = true) {
  const val = process.env[name];
  if (required && (!val || !val.trim())) {
    throw new Error(`Missing env ${name}`);
  }
  return val;
}

function sanitizeSegment(s) {
  // Solo letras, números, guiones, paréntesis y espacios puntuales
  return String(s || "").replace(/[^A-Za-z0-9._() -]/g, "").trim();
}

function ensureSlugAllowed(inputSlug) {
  const publicSlug = process.env.PUBLIC_INVESTOR_SLUG;
  if (publicSlug && publicSlug.trim()) {
    if (inputSlug !== publicSlug) {
      throw httpError(403, "Slug not allowed");
    }
    return publicSlug;
  }
  return inputSlug; // fallback si no hay PUBLIC_INVESTOR_SLUG
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { category, slug, filename, contentBase64 } = reqJson(event);

    if (!category || !slug || !filename || !contentBase64) {
      throw httpError(400, "Missing category/slug/filename/contentBase64");
    }

    const safeCategory = sanitizeSegment(category);
    const safeFilename = sanitizeSegment(filename);
    const sanitizedSlug = sanitizeSegment(slug);

    if (!safeCategory || !sanitizedSlug || !safeFilename) {
      throw httpError(400, "Invalid category/slug/filename");
    }

    const safeSlug = ensureSlugAllowed(sanitizedSlug);

    const path = `${safeCategory}/${safeSlug}/${safeFilename}`;

    const DOCS_REPO = getEnv("DOCS_REPO");
    const DOCS_BRANCH = getEnv("DOCS_BRANCH");
    const GITHUB_TOKEN = getEnv("GITHUB_TOKEN");
    const [owner, repo] = DOCS_REPO.split("/");

    // Validar que el base64 sea decodificable
    let binary;
    try {
      binary = Buffer.from(contentBase64, "base64");
      if (!binary || !binary.length) throw new Error("decoded empty");
    } catch (e) {
      throw httpError(400, `Invalid base64: ${e.message}`);
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Obtener sha si el archivo ya existe (para update)
    let sha;
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path, ref: DOCS_BRANCH });
      // Puede venir como objeto (file) o array (dir). Queremos file.
      if (!Array.isArray(data) && data.sha) sha = data.sha;
    } catch {
      // Si 404, es nuevo; continuar sin sha
    }

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `chore(docs): upload ${path}`,
      content: binary.toString("base64"), // GitHub API exige base64
      branch: DOCS_BRANCH,
      sha,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, path }),
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? "upload-doc error" : err.message;
    return { statusCode, body: message };
  }
}
