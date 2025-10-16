import { getGithubFileBinary } from './lib/storage.mjs';
import { json, binary, getUrlAndParams } from './_shared/http.mjs';
import { buildDocumentPath, joinPath, sanitize } from './_shared/paths.mjs';
import { ensureSlugAllowed } from './_shared/ensureSlugAllowed.mjs';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';
const DEFAULT_DISPOSITION = 'attachment';

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
};

const corsPreflightHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function guessContentType(filename = '') {
  const extension = filename.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'txt') return 'text/plain';
  return DEFAULT_CONTENT_TYPE;
}

function sanitizeSegment(value, field) {
  const segment = (value ?? '').toString().trim();
  if (!segment) {
    const error = new Error(`Missing ${field}`);
    error.statusCode = 400;
    throw error;
  }
  if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
    const error = new Error(`Invalid ${field}`);
    error.statusCode = 400;
    throw error;
  }
  return segment;
}

function normalizeDisposition(value) {
  const normalized = (value ?? '').toString().trim().toLowerCase();
  return normalized === 'inline' ? 'inline' : DEFAULT_DISPOSITION;
}

export default async function handler(request, context) {
  const method = request.method?.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsPreflightHeaders });
  }

  if (method && method !== 'GET') {
    return json(
      { ok: false, error: 'Method not allowed', allowed: ['GET'] },
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const { params } = getUrlAndParams(request);

    const slugParam = params.get('slug');
    const categoryParam = params.get('category');
    const filenameParam = params.get('filename');
    const dispositionParam = params.get('disposition');

    if (!slugParam || !categoryParam || !filenameParam) {
      const missing = [
        !slugParam && 'slug',
        !categoryParam && 'category',
        !filenameParam && 'filename',
      ].filter(Boolean);
      return json(
        { ok: false, error: `Missing required params: ${missing.join(', ')}` },
        { status: 400, headers: corsHeaders },
      );
    }

    const slug = ensureSlugAllowed(String(slugParam).trim(), { request, context });
    const category = sanitizeSegment(categoryParam, 'category');
    const filename = sanitizeSegment(filenameParam, 'filename');
    const disposition = normalizeDisposition(dispositionParam);

    // Build the correct, unique path using the new helpers
    const documentDir = buildDocumentPath(category, slug);
    const path = joinPath(documentDir, filename);

    let buffer;
    let size;

    try {
      const result = await getGithubFileBinary({ path });
      buffer = result?.buffer ?? null;
      size = result?.size ?? 0;
    } catch (error) {
      if (error?.message === 'NotFound' || error?.status === 404 || error?.statusCode === 404) {
        return json({ ok: false, error: 'File not found at path: ' + path }, { status: 404, headers: corsHeaders });
      }
      throw error; // Let the generic handler manage other errors
    }

    if (!buffer || buffer.length === 0) {
      return json({ ok: false, code: 'EmptyFile', error: 'The requested file is empty.' }, { status: 404, headers: corsHeaders });
    }

    const mimetype = guessContentType(filename);

    return binary(buffer, {
      filename,
      contentType: mimetype,
      disposition,
      headers: {
        ...corsHeaders,
        ...(size ? { 'Content-Length': String(size) } : {}),
      },
    });
  } catch (error) {
    const status = error?.statusCode || error?.status || 500;
    const message = error?.message || 'Internal Server Error';

    if (error?.message === 'ForbiddenSlug') {
      return json({ ok: false, error: message }, { status: 403, headers: corsHeaders });
    }

    console.error('download-file error', { status, message, error });
    return json({ ok: false, error: message }, { status, headers: corsHeaders });
  }
}