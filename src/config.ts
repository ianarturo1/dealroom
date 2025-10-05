export const DOCS_REPO_WEB = import.meta.env.VITE_DOCS_REPO_WEB || 'https://github.com/ianarturo1/dealroom';
export const DOCS_BRANCH = import.meta.env.VITE_DOCS_BRANCH || 'main';
export const DOCS_ROOT_DIR = import.meta.env.VITE_DOCS_ROOT_DIR ?? 'dealroom';

function normalizeSegment(segment: string) {
  return segment.replace(/^\/+|\/+$/g, '');
}

export function getGithubFolderUrl(category: string, slug: string) {
  const repo = DOCS_REPO_WEB.replace(/\/+$/, '');
  const branch = normalizeSegment(DOCS_BRANCH);
  const parts = [DOCS_ROOT_DIR, category, slug]
    .map(normalizeSegment)
    .filter((part) => part.length > 0);

  const path = parts.join('/');

  return `${repo}/tree/${branch}${path ? `/${path}` : ''}`;
}
