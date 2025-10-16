import { Octokit } from 'octokit';
import { json, methodNotAllowed } from './_shared/http.mjs';
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

async function main(request, context) {
  const body = await request.json();

  const { slug: rawSlug, category: rawCategory, name: rawName } = body;

  if (!rawSlug || !rawCategory || !rawName) {
    return json(
      { ok: false, error: 'Missing fields: slug, category, name' },
      { status: 400, headers: corsHeaders },
    );
  }

  let slug;
  try {
    slug = ensureSlugAllowed(String(rawSlug), { request, context });
  } catch (e) {
    return json(
      { ok: false, error: e?.message || 'ForbiddenSlug' },
      { status: e?.statusCode || 403, headers: corsHeaders },
    );
  }

  const category = ensureSafeSegment(String(rawCategory), 'category');
  const filename = ensureSafeSegment(String(rawName), 'filename');

  // Build the one, true path to the document.
  const documentDir = buildDocumentPath(category, slug);
  const filePath = joinPath(documentDir, filename);

  const octokit = new Octokit({ auth: TOKEN });

  // 1. Get the SHA of the file to be deleted.
  let sha;
  try {
    const res = await octokit.rest.repos.getContent({ owner, repo, path: filePath, ref: DOCS_BRANCH });
    if (Array.isArray(res.data)) {
      throw new Error('Path points to a directory, not a file.');
    }
    sha = res.data.sha;
  } catch (err) {
    if (err?.status === 404) {
      return json({ ok: false, error: 'File not found at path: ' + filePath }, { status: 404, headers: corsHeaders });
    }
    throw err; // For other errors, let the generic handler catch it.
  }

  // 2. Delete the file using its SHA.
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
}

export default async function handler(request, context) {
  const method = request.method?.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (method !== 'POST') {
    return methodNotAllowed(['POST'], { headers: corsHeaders });
  }

  try {
    return await main(request, context);
  } catch (err) {
    const code = err?.status || err?.statusCode || 500;
    const msg = err?.message || 'Internal Error';
    console.error('[delete-doc]', { status: code, message: msg });
    return json({ ok: false, error: msg }, { status: code, headers: corsHeaders });
  }
}