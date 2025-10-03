// netlify/functions/lib/storage.js
import { Octokit } from "octokit";

const required = (name, val) => { if (!val) throw new Error(`MissingEnv:${name}`); return val; };
const getOctokit = () => new Octokit({ auth: required('GITHUB_TOKEN', process.env.GITHUB_TOKEN) });
const getRepo = () => {
  const repoFull = required('DOCS_REPO', process.env.DOCS_REPO);
  const [owner, repo] = repoFull.split('/');
  return { owner, repo, branch: process.env.DOCS_BRANCH || 'main' };
};

export async function putFileGithub({ path, contentBase64, message, branch, author }) {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  const branchName = branch || process.env.DOCS_BRANCH || 'main';

  let sha;
  try {
    const res = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref: branchName });
    sha = res?.data?.sha;
  } catch (_) {}

  const res = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner, repo, path,
    message: message || `Upload: ${path}`,
    content: contentBase64,
    branch: branchName,
    committer: author || { name: "Dealroom Bot", email: "bot@finsolar.mx" },
    author:    author || { name: "Dealroom Bot", email: "bot@finsolar.mx" },
    ...(sha ? { sha } : {})
  });
  return { ok:true, commitSha: res.data.commit.sha };
}

/**
 * Nuevo: obtiene el BINARIO del archivo con token (sirve en repo PRIVADO o público)
 * Retorna { buffer, size }
 */
export async function getGithubFileBinary({ path, branch }) {
  const octokit = getOctokit();
  const { owner, repo } = getRepo();
  const branchName = branch || process.env.DOCS_BRANCH || 'main';

  // 1) Metadata para tamaño/existencia
  const meta = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner, repo, path, ref: branchName
  });
  if (!meta?.data) throw new Error('NotFound');
  const size = meta.data.size || 0;

  // 2) Contenido RAW autenticado (binario)
  const raw = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
    owner, repo, path, ref: branchName,
    headers: { 'Accept': 'application/vnd.github.raw' }
  });

  const buffer = Buffer.isBuffer(raw.data) ? raw.data : Buffer.from(raw.data);
  return { buffer, size };
}
