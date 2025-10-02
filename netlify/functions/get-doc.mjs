// netlify/functions/get-doc.mjs
import { Octokit } from "octokit";

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getEnv(name, required = true) {
  const val = process.env[name];
  if (required && (!val || !val.trim())) {
    throw new Error(`Missing env ${name}`);
  }
  return val;
}

function sanitizeSegment(s) {
  return String(s || "").replace(/[^A-Za-z0-9._ -]/g, "").trim();
}

function ensureSlugAllowed(inputSlug) {
  const publicSlug = process.env.PUBLIC_INVESTOR_SLUG;
  if (publicSlug && publicSlug.trim()) {
    if (inputSlug !== publicSlug) {
      throw httpError(403, "Slug not allowed");
    }
    return publicSlug;
  }
  return inputSlug;
}

function guessContentType(filename) {
  const f = filename.toLowerCase();
  if (f.endsWith(".pdf")) return "application/pdf";
  if (f.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (f.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (f.endsWith(".csv")) return "text/csv";
  if (f.endsWith(".png")) return "image/png";
  if (f.endsWith(".jpg") || f.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const params = event.queryStringParameters || {};
    const category = sanitizeSegment(params.category);
    const sanitizedSlug = sanitizeSegment(params.slug);
    const filename = sanitizeSegment(params.filename);

    if (!category || !sanitizedSlug || !filename) {
      throw httpError(400, "Missing category/slug/filename");
    }

    const slug = ensureSlugAllowed(sanitizedSlug);

    const path = `${category}/${slug}/${filename}`;

    const DOCS_REPO = getEnv("DOCS_REPO");
    const DOCS_BRANCH = getEnv("DOCS_BRANCH");
    const GITHUB_TOKEN = getEnv("GITHUB_TOKEN");

    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const [owner, repo] = DOCS_REPO.split("/");

    // Traer contenido en base64 desde GitHub
    let metadata;
    try {
      ({ data: metadata } = await octokit.repos.getContent({ owner, repo, path, ref: DOCS_BRANCH }));
    } catch (err) {
      if (err?.status === 404) {
        throw httpError(404, "File not found");
      }
      throw err;
    }

    if (Array.isArray(metadata) || metadata.type !== "file" || !metadata.sha) {
      throw httpError(404, "File not found");
    }

    const { data: blob } = await octokit.request("GET /repos/{owner}/{repo}/git/blobs/{file_sha}", {
      owner,
      repo,
      file_sha: metadata.sha,
    });

    if (!blob || blob.encoding !== "base64" || !blob.content) {
      throw httpError(500, "Invalid blob");
    }

    const base64 = blob.content.replace(/\r?\n/g, "");
    const contentType = guessContentType(filename);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Importante para Netlify: estamos devolviendo base64
        "Cache-Control": "no-store",
      },
      body: base64,
      isBase64Encoded: true,
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? "get-doc error" : err.message;
    return { statusCode, body: message };
  }
}
