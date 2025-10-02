// netlify/functions/upload-doc.mjs
import { Buffer } from "node:buffer";

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
  return String(s || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._() \-]/gu, "")
    .trim();
}

function ensureSlugAllowed(inputSlug) {
  const publicSlugRaw = process.env.PUBLIC_INVESTOR_SLUG;
  const envSlug = sanitizeSegment(publicSlugRaw);
  if (envSlug) {
    if (inputSlug.toLowerCase() !== envSlug.toLowerCase()) {
      throw httpError(403, "Slug not allowed");
    }
    return envSlug.toLowerCase();
  }
  return inputSlug.toLowerCase(); // fallback si no hay PUBLIC_INVESTOR_SLUG
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = reqJson(event);
    let { category, slug, filename, contentBase64 } = body;
    if (!category && body?.path){
      category = body.path;
    }

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

    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
    const authHeaders = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Obtener sha si el archivo ya existe (para update)
    let sha;
    try {
      const metadataResp = await fetch(`${baseUrl}?ref=${encodeURIComponent(DOCS_BRANCH)}`, {
        method: "GET",
        headers: authHeaders,
      });

      if (metadataResp.status === 200) {
        const metadata = await metadataResp.json();
        if (!Array.isArray(metadata) && metadata?.type === "file" && metadata?.sha) {
          sha = metadata.sha;
        } else {
          throw httpError(404, "File not found");
        }
      } else if (metadataResp.status === 404) {
        // Archivo nuevo, continuar sin sha
      } else if (metadataResp.status === 401 || metadataResp.status === 403) {
        throw httpError(500, "GitHub auth error");
      } else {
        throw httpError(500, "GitHub metadata error");
      }
    } catch (err) {
      if (err.statusCode === 404) throw err;
      if (err.statusCode) throw err;
      throw httpError(500, "GitHub metadata error");
    }

    const putBody = {
      message: `chore(docs): upload ${path}`,
      content: binary.toString("base64"),
      branch: DOCS_BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putResp = await fetch(baseUrl, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(putBody),
    });

    if (putResp.status !== 200 && putResp.status !== 201) {
      if (putResp.status === 401 || putResp.status === 403) {
        throw httpError(500, "GitHub auth error");
      }

      let errorMessage = "GitHub upload error";
      try {
        const errorJson = await putResp.json();
        if (errorJson?.message) {
          errorMessage = errorJson.message;
        }
      } catch {
        // ignore JSON parse errors
      }
      throw httpError(500, errorMessage);
    }

    return {
      statusCode: putResp.status,
      body: JSON.stringify({ ok: true, path }),
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = statusCode === 500 ? "upload-doc error" : err.message;
    return { statusCode, body: message };
  }
}
