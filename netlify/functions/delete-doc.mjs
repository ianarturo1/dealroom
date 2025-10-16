import { Octokit } from 'octokit';
import { json, methodNotAllowed, getUrlAndParams } from './_shared/http.mjs';
import { buildDocumentPath, joinPath, sanitize } from './_shared/paths.mjs';
import { ensureSlugAllowed } from './_shared/ensureSlugAllowed.mjs';

function requiredEnv(name) {
  const v = (process.env[name] || '').trim();
  if (!v) {
    const e = new Error(`Missing env ${name}`);
    e.status = 500;
    throw e;
  }
  return v;
}

function ensureSafeSegment(value, label) {
  const clean = sanitize(value);
  if (!clean || clean.includes('..') || clean.includes('/') || clean.includes('\\')) {
    const e = new Error(`Invalid ${label || 'segment'}`);
    e.status = 400;
    throw e;
  }
  return clean;
}

const REPO_FULL = requiredEnv('DOCS_REPO');
const DOCS_BRANCH = requiredEnv('DOCS_BRANCH');
const TOKEN = requiredEnv('GITHUB_TOKEN');

const [owner, repo] = REPO_FULL.split('/');
if (!owner || !repo) {
  throw Object.assign(new Error('Invalid DOCS_REPO'), { status: 500 });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(request, context) {
  const method = request.method?.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // We use POST for the delete operation for semantic reasons, even though params are in the URL.
  if (method !== 'POST') {
    return methodNotAllowed(['POST'], { headers: corsHeaders });
  }

  try {
    const { params } = getUrlAndParams(request);
    const rawSlug = params.get('slug');
    const rawCategory = params.get('category');
    const rawName = params.get('name');

    if (!rawSlug || !rawCategory || !rawName) {
      return json(
        { ok: false, error: 'Missing query parameters: slug, category, and name are all required.' },
        { status: 400, headers: corsHeaders },
      );
    }

    const slug = ensureSlugAllowed(String(rawSlug), { request, context });
    const category = ensureSafeSegment(String(rawCategory), 'category');
    const filename = ensureSafeSegment(String(rawName), 'filename');

    const documentDir = buildDocumentPath(category, slug);
    const filePath = joinPath(documentDir, filename);

    const octokit = new Octokit({ auth: TOKEN });

    let sha;
    try {
      const res = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: DOCS_BRANCH });
      if (Array.isArray(res.data)) {
        throw new Error('Path points to a directory, not a file.');
      }
      sha = res.data.sha;
    } catch (err) {
      if (err?.status === 404) {
        return json({ ok: false, error: `File not found at path: ${filePath}` }, { status: 404, headers: corsHeaders });
      }
      throw err;
    }

    const message = `chore(delete-doc): ${category}/${slug}/${filename}`;
    await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: filePath,
      message,
      sha,
      branch: DOCS_BRANCH,
    });

    return json({ ok: true, path: filePath }, { status: 200, headers: corsHeaders });

  } catch (err) {
    const code = err?.status || err?.statusCode || 500;
    const msg = err?.message || 'Internal Error';
    console.error('[delete-doc]', { status: code, message: msg, url: request.url });
    return json({ ok: false, error: msg }, { status: code, headers: corsHeaders });
  }
}