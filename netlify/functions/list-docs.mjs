import { Octokit } from 'octokit';
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs';
import { buildDocumentPath, sanitize } from './_shared/paths.mjs';
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

const OWNER_REPO = requiredEnv('DOCS_REPO');
const BRANCH = requiredEnv('DOCS_BRANCH');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
const gh = octokit.rest ? octokit.rest : octokit;

function ensureCategory(value) {
  const clean = sanitize(value);
  if (!clean || clean.includes('..')) {
    const e = new Error('Invalid category');
    e.status = 400;
    throw e;
  }
  return clean;
}

function normalizeSlug(value, event) {
  if (!value) return '';
  try {
    return ensureSlugAllowed(value, event);
  } catch (err) {
    throw err;
  }
}

export default async function handler(request, context) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET']);

  const { params } = getUrlAndParams(request);
  const rawCategory = params.get('category');
  const rawSlug = params.get('slug');

  let category;
  try {
    category = ensureCategory(rawCategory);
  } catch (err) {
    const status = err?.status || err?.statusCode || 400;
    return json({ ok: false, error: err?.message || 'Invalid category' }, { status });
  }

  let slug = '';
  if (rawSlug) {
    try {
      slug = normalizeSlug(rawSlug, { request, context });
    } catch (err) {
      const status = err?.status || err?.statusCode || 403;
      return json({ ok: false, error: err?.message || 'Slug inválido' }, { status });
    }
  }

  const [owner, repo] = OWNER_REPO.split('/');
  const documentPath = buildDocumentPath(category, slug);
  const files = [];

  try {
    const res = await gh.repos.getContent({ owner, repo, path: documentPath, ref: BRANCH });
    const items = Array.isArray(res.data) ? res.data : [];
    const fileItems = items.filter((item) => item.type === 'file');

    for (const item of fileItems) {
      files.push({
        name: item.name,
        size: item.size,
        path: item.path,
        download_url: item.download_url,
        sha: item.sha,
        source: 'new', // All files now come from the "new" unique path
      });
    }
  } catch (err) {
    // If the directory doesn't exist, it's not an error, it just means no files.
    if (err?.status === 404) {
      return json({
        ok: true,
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        scope: slug ? 'investor' : 'category',
        files: [],
        path: documentPath,
      });
    }
    // For other errors, return a server error.
    return json(
      {
        ok: false,
        error: err?.message || String(err),
        status: err?.status || 500,
        repoUsed: OWNER_REPO,
        branchUsed: BRANCH,
        pathTried: documentPath,
      },
      { status: err?.status || 500 },
    );
  }

  const scope = slug ? 'investor' : 'category';

  return json({
    ok: true,
    repoUsed: OWNER_REPO,
    branchUsed: BRANCH,
    scope,
    files,
    path: documentPath,
  });
}