export const DOCS_REPO_WEB = import.meta.env.VITE_DOCS_REPO_WEB || 'https://github.com/ianarturo1/dealroom';
export const DOCS_BRANCH   = import.meta.env.VITE_DOCS_BRANCH   || 'main';
export const DOCS_ROOT_DIR = (import.meta.env.VITE_DOCS_ROOT_DIR ?? 'dealroom').trim(); // puede ser ''

function normalizePath(p: string) {
  return p.replace(/\/+/g, '/').replace(/(^\/|\/$)/g, '');
}
function seg(v: string) {
  // normaliza y codifica cada segmento (espacios/acentos)
  return encodeURIComponent(normalizePath(v));
}
function rootDir(): string {
  return DOCS_ROOT_DIR ? `/${normalizePath(DOCS_ROOT_DIR)}` : '';
}

// /<root?>/<categoria>/<slug>
export function getGithubFolderUrl(category: string, slug: string) {
  const base = DOCS_REPO_WEB.replace(/\/+$/, '');
  return `${base}/tree/${DOCS_BRANCH}${rootDir()}/${seg(category)}/${seg(slug)}`;
}

// /<root?>/<categoria>
export function getGithubCategoryUrl(category: string) {
  const base = DOCS_REPO_WEB.replace(/\/+$/, '');
  return `${base}/tree/${DOCS_BRANCH}${rootDir()}/${seg(category)}`;
}
