const BASE = '/.netlify/functions';

function isFormData(body) {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

function looksLikeBinaryResponse(contentType, contentDisposition) {
  const ct = (contentType || '').toLowerCase();
  const cd = (contentDisposition || '').toLowerCase();
  if (cd && /attachment|filename\*=|filename=/i.test(cd)) return true;
  if (!ct) return false;
  if (ct.includes('application/json')) return false;
  if (ct.startsWith('text/')) return false;
  if (ct.includes('charset=')) return false;
  if (ct.includes('application/javascript') || ct.includes('application/xml') || ct.includes('application/xhtml')) return false;
  if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) return false;
  const binaryHints = [
    'application/pdf',
    'application/octet-stream',
    'application/zip',
    'application/x-zip-compressed',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats',
    'application/vnd.ms-',
    'application/vnd.oasis.opendocument',
    'application/vnd.apple',
    'application/vnd.adobe',
    'wordprocessingml',
    'spreadsheetml',
    'presentationml'
  ];
  if (binaryHints.some((hint) => ct.includes(hint))) return true;
  if (ct.startsWith('image/') || ct.startsWith('audio/') || ct.startsWith('video/')) return true;
  return false;
}

async function req(path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };

  if (isFormData(body)) {
    init.body = body; // dejar al browser setear boundary
  } else if (body && typeof body === 'object' && !(body instanceof Blob)) {
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
    init.body = JSON.stringify(body);
  } else if (body !== undefined) {
    init.body = body;
  }

  const url = resolveUrl(path);
  const res = await fetch(url, init);
  const ct = res.headers.get('content-type') || '';
  const cd = res.headers.get('content-disposition') || '';
  if (res.ok && looksLikeBinaryResponse(ct, cd)) {
    const error = new Error('La respuesta parece binaria. Usa api.downloadDocument() o un enlace directo para descargas.');
    error.code = 'UNSUPPORTED_BINARY_RESPONSE';
    error.status = res.status;
    error.statusText = res.statusText;
    error.url = url;
    error.contentType = ct;
    error.contentDisposition = cd;
    throw error;
  }
  const isJson = ct.includes('application/json');
  const payload = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => '');

  if (!res.ok) {
    const message = isJson
      ? (payload && typeof payload === 'object'
        ? (payload.message || payload.msg || payload.error || payload.code || `${res.status} ${res.statusText}`)
        : `${res.status} ${res.statusText}`)
      : (typeof payload === 'string' && payload ? payload : `${res.status} ${res.statusText}`);
    const error = new Error(message);
    error.status = res.status;
    error.statusText = res.statusText;
    error.data = payload;
    throw error;
  }

  return payload;
}

// NUEVO: para respuestas binarias (mantener headers & acceso a blob())
async function reqBlob(path, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };

  if (isFormData(body)) {
    init.body = body;
  } else if (body && typeof body === 'object' && !(body instanceof Blob)) {
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
    init.body = JSON.stringify(body);
  } else if (body !== undefined) {
    init.body = body;
  }

  const url = resolveUrl(path);
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return res; // devolvemos Response para leer headers y blob()
}

function resolveUrl(path = '') {
  if (!path) return BASE;
  if (path.startsWith('http')) return path;
  if (path.startsWith(BASE)) return path;
  if (path.startsWith('/')) return `${BASE}${path}`;
  return `${BASE}/${path}`;
}

// Utilidad: obtener filename desde Content-Disposition
function extractFilenameFromContentDisposition(cdHeader, fallback) {
  if (!cdHeader) return fallback;
  const match = cdHeader.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/i);
  if (!match) return fallback;
  try {
    return decodeURIComponent(match[1] || match[2]);
  } catch {
    return fallback;
  }
}

// Descargar documento como Blob y disparar <a download>
async function downloadDocument({ slug, category, filename, disposition = 'attachment' }){
  const path = `/.netlify/functions/get-doc?slug=${encodeURIComponent(slug)}&category=${encodeURIComponent(category)}&filename=${encodeURIComponent(filename)}&disposition=${encodeURIComponent(disposition)}`;
  const res = await reqBlob(path, { method: 'GET' });
  const blob = await res.blob();

  const cd = res.headers.get('Content-Disposition') || '';
  const dlName = extractFilenameFromContentDisposition(cd, filename);

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dlName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Subir documento con FormData
async function uploadDocument({ slug, category, file }) {
  const form = new FormData();
  form.append('slug', slug);
  form.append('category', category);
  form.append('file', file, file.name);
  return req('/.netlify/functions/upload-doc', { method: 'POST', body: form });
}

export const api = {
  req,               // JSON/texto
  reqBlob,           // binario (Response)
  downloadDocument,  // descarga controlada
  uploadDocument,    // subida con FormData
  listProjects(){ return req('/.netlify/functions/list-projects'); },
  saveProjects(projects){
    return req('/.netlify/functions/save-projects', {
      method: 'POST',
      body: { projects }
    });
  },
  listInvestors(){ return req('/.netlify/functions/list-investors'); },
  deleteInvestor(slug){
    return req('/.netlify/functions/delete-investor', {
      method: 'POST',
      body: { slug }
    });
  },
  getInvestor(slug){ return req(`/.netlify/functions/get-investor${slug ? (`?slug=${encodeURIComponent(slug)}`) : ''}`); },
  listDocs(params){
    const q = new URLSearchParams(params || {}).toString();
    return req(`/.netlify/functions/list-docs${q ? (`?${q}`) : ''}`);
  },
  async uploadDoc(info, options = {}){
    const endpoint = options.endpoint || '/.netlify/functions/upload-doc';
    return req(endpoint, { method: 'POST', body: info });
  },
  async deleteDoc(info){
    return req('/.netlify/functions/delete-doc', { method: 'POST', body: info });
  },
  async updateStatus(payload){
    return req('/.netlify/functions/update-status', { method: 'POST', body: payload });
  },
  async createInvestor(payload){
    return req('/.netlify/functions/create-investor', { method: 'POST', body: payload });
  },
  calendarIcsUrl(slug){
    return `/.netlify/functions/calendar?slug=${encodeURIComponent(slug)}`;
  },
  downloadDocPath(relPath, options = {}){
    const disposition = (options && options.disposition) || 'attachment';
    const normalized = (relPath || '').replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.length >= 5 && parts[0] === 'data' && parts[1] === 'docs'){
      const slug = parts[2];
      const category = parts[3];
      const filename = parts.slice(4).join('/');
      return this.docDownloadUrl({ category, slug, filename, disposition });
    }
    if (parts.length >= 3){
      const [category, slug, ...rest] = parts;
      const filename = rest.join('/');
      if ((slug || '').toLowerCase() === 'alsea'){
        return this.docDownloadUrl({ category, slug, filename, disposition });
      }
    }
    const legacySlug = parts.length > 1 ? parts[1] : '';
    const params = new URLSearchParams();
    if (normalized) params.set('path', normalized);
    if (legacySlug) params.set('investor', legacySlug);
    const qs = params.toString();
    return `/.netlify/functions/get-doc${qs ? `?${qs}` : ''}`;
  },
  docDownloadUrl({ category, slug, filename, disposition = 'attachment' }){
    const normalizedSlug = (slug || '').trim().toLowerCase();
    const normalizedCategory = (category || '').trim();
    const normalizedFilename = filename === undefined || filename === null ? '' : String(filename);
    const safeDisposition = disposition === 'inline' ? 'inline' : 'attachment';
    const isFeatureOn = import.meta.env?.VITE_DOCS_BACKEND_ALSEA === 'on';
    if (normalizedSlug === 'alsea' && isFeatureOn){
      const params = new URLSearchParams();
      params.set('slug', 'alsea');
      if (normalizedCategory) params.set('category', normalizedCategory);
      if (normalizedFilename) params.set('filename', normalizedFilename);
      params.set('disposition', safeDisposition);
      const qs = params.toString();
      return `/.netlify/functions/download-file${qs ? `?${qs}` : ''}`;
    }
    const params = new URLSearchParams();
    if (normalizedCategory) params.set('category', normalizedCategory);
    if (slug) params.set('slug', slug);
    if (normalizedFilename) params.set('filename', normalizedFilename);
    const qs = params.toString();
    return `/.netlify/functions/get-doc${qs ? `?${qs}` : ''}`;
  },
  async listActivity(){
    return req('/.netlify/functions/list-activity');
  }
};

function parseDocPath(relPath){
  const normalized = (relPath || '').replace(/^\/+/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length >= 4 && parts[0] === 'data' && parts[1] === 'docs'){
    return {
      slug: parts[2] || '',
      category: parts[3] || '',
      filename: parts.slice(4).join('/') || ''
    };
  }
  if (parts.length >= 3){
    return {
      category: parts[0] || '',
      slug: parts[1] || '',
      filename: parts.slice(2).join('/') || ''
    };
  }
  return { category: '', slug: '', filename: '' };
}

