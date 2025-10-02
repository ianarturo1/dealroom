// netlify/functions/upload-doc.mjs
import { Buffer } from "node:buffer";

const ALLOWED_SEGMENT = /^[A-Za-z0-9._() \-]+$/;

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

function normalizeSegment(name, value) {
  if (value === undefined || value === null) {
    return "";
  }

  const str = String(value).trim();
  if (!str) {
    return "";
  }

  if (!ALLOWED_SEGMENT.test(str)) {
    throw httpError(400, `Invalid ${name}`);
  }

  return str;
}

function ensureSlugAllowed(slug) {
  const envSlugRaw = process.env.PUBLIC_INVESTOR_SLUG;
  if (!envSlugRaw) {
    return slug;
  }

  const envSlug = String(envSlugRaw).trim();
  if (!envSlug) {
    return slug;
  }

  if (!ALLOWED_SEGMENT.test(envSlug)) {
    return slug;
  }

  if (slug.toLowerCase() !== envSlug.toLowerCase()) {
    throw httpError(403, "Slug not allowed");
  }

  return envSlug;
}

async function githubErrorMessage(response) {
  let message = "GitHub upload error";
  try {
    const data = await response.json();
    if (data?.message) {
      message = `${message}: ${data.message}`;
    }
  } catch {
    // ignore JSON parse errors
  }
  return message;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = reqJson(event);

    const rawPath = typeof body.path === "string" ? body.path : "";
    const rawContentBase64 = typeof body.contentBase64 === "string" ? body.contentBase64 : "";

    if (!rawContentBase64.trim()) {
      throw httpError(400, "Missing contentBase64");
    }

    let category = "";
    let slug = "";
    let filename = "";

    if (rawPath.trim()) {
      const segments = rawPath
        .replace(/\\/g, "/")
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);

      if (segments.length !== 3) {
        throw httpError(400, "Missing category/slug/filename");
      }

      category = normalizeSegment("category", segments[0]);
      slug = normalizeSegment("slug", segments[1]);
      filename = normalizeSegment("filename", segments[2]);
    } else {
      category = normalizeSegment("category", body.category);
      slug = normalizeSegment("slug", body.slug);
      filename = normalizeSegment("filename", body.filename);

      if (!category || !slug || !filename) {
        throw httpError(400, "Missing category/slug/filename");
      }
    }

    if (!category || !slug || !filename) {
      throw httpError(400, "Missing category/slug/filename");
    }

    slug = ensureSlugAllowed(slug);

    const path = `${category}/${slug}/${filename}`;

    const base64Body = rawContentBase64
      .trim()
      .replace(/^data:.*?;base64,/i, "")
      .replace(/\s+/g, "");

    if (!base64Body) {
      throw httpError(400, "Invalid base64");
    }

    let binary;
    try {
      binary = Buffer.from(base64Body, "base64");
    } catch {
      throw httpError(400, "Invalid base64");
    }

    if (!binary || !binary.length) {
      throw httpError(400, "Invalid base64");
    }

    const normalizedBase64 = binary.toString("base64");
    const base64NoPad = normalizedBase64.replace(/=+$/g, "");
    const inputNoPad = base64Body.replace(/=+$/g, "");
    if (!base64Body || base64NoPad !== inputNoPad) {
      throw httpError(400, "Invalid base64");
    }

    const DOCS_REPO = getEnv("DOCS_REPO");
    const DOCS_BRANCH = getEnv("DOCS_BRANCH");
    const GITHUB_TOKEN = getEnv("GITHUB_TOKEN");
    const [owner, repo] = DOCS_REPO.split("/");

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
      } else if ([401, 403, 422].includes(metadataResp.status)) {
        throw httpError(500, await githubErrorMessage(metadataResp));
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
      content: normalizedBase64,
      branch: DOCS_BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putResp = await fetch(baseUrl, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(putBody),
    });
    if (putResp.status !== 200 && putResp.status !== 201) {
      if ([401, 403, 422].includes(putResp.status)) {
        throw httpError(500, await githubErrorMessage(putResp));
      }

      throw httpError(500, await githubErrorMessage(putResp));
    }

    return {
      statusCode: putResp.status,
      body: JSON.stringify({ ok: true, path }),
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const message = err.message || "upload-doc error";
    return { statusCode, body: message };
  }
}
