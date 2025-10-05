export const DOCS_REPO_WEB = import.meta.env.VITE_DOCS_REPO_WEB || 'https://github.com/ianarturo1/dealroom';

export const DOCS_BRANCH = import.meta.env.VITE_DOCS_BRANCH || 'main';

export function getGithubFolderUrl(category: string, slug: string) {
  return `${DOCS_REPO_WEB}/tree/${DOCS_BRANCH}/dealroom/${category}/${slug}`;
}
