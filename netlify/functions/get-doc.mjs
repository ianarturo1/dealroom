import { Octokit } from 'octokit';
import { getUrlAndParams, json, methodNotAllowed } from './_shared/http.mjs';
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

const OWNER_REPO = requiredEnv('DOCS_REPO');
const BRANCH = requiredEnv('DOCS_BRANCH');

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN || undefined });
const gh = octokit.rest ? octokit.rest : octokit;

const decode = (s) => decodeURIComponent(String(s || '')).replace(/\+/g, ' ').trim();
const normalizeDisposition = (value) => {
  const v = String(value || '').trim().toLowerCase();
  return v === 'inline' ? 'inline' : 'attachment';
};
const escapeFilename = (name) => String(name || '').replace(/"/g, '\\"');

function ensureSafeParam(value, paramName) {
  const clean = sanitize(value);
  if (!clean) {
    const e = new Error(`Missing or invalid ${paramName}`);
    e.status = 400;
    throw e;
  }
  if (clean.includes('..') || /[\\/]/.test(clean)) {
    const e = new Error(`Invalid characters in ${paramName}`);
    e.status = 400;
    throw e;
  }
  return clean;
}

async function fetchFile(path) {
    const [owner, repo] = OWNER_REPO.split('/');
    try {
        const res = await gh.repos.getContent({ owner, repo, path, ref: BRANCH });
        if (res.data?.type !== 'file') {
            const err = new Error('Not a file');
            err.status = 404;
            throw err;
        }
        return res.data;
    } catch (err) {
        if (err.status === 404) {
             const error = new Error('File not found');
             error.status = 404;
             throw error;
        }
        throw err;
    }
}

export default async function handler(request, context) {
  if (request.method?.toUpperCase() !== 'GET') return methodNotAllowed(['GET']);

  const { params } = getUrlAndParams(request);
  const rawCategory = decode(params.get('category'));
  const rawSlug = decode(params.get('slug'));
  const rawFilename = decode(params.get('filename'));
  const disposition = normalizeDisposition(params.get('disposition'));

  try {
    const slug = ensureSlugAllowed(rawSlug, { request, context });
    const category = ensureSafeParam(rawCategory, 'category');
    const filename = ensureSafeParam(rawFilename, 'filename');

    // Build the one, true path
    const path = joinPath(buildDocumentPath(category, slug), filename);

    const fileData = await fetchFile(path);

    // Prefer redirecting to the download URL for efficiency
    if (fileData.download_url) {
      return new Response(null, { status: 302, headers: { Location: fileData.download_url } });
    }

    // As a fallback, serve the content directly
    const buf = Buffer.from(fileData.content || '', 'base64');
    const safeName = escapeFilename(fileData.name || filename);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${safeName}"`,
      },
    });

  } catch (err) {
    const status = err?.status || 500;
    const message = err?.message || 'An unexpected error occurred.';
    return json({ ok: false, error: message }, { status });
  }
}