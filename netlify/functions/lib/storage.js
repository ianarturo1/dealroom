// netlify/functions/lib/storage.js
import { Octokit } from "octokit";

const required = (name, val) => { if (!val) throw new Error(`MissingEnv:${name}`); return val; };

export async function putFileGithub({ path, contentBase64, message, branch, author }) {
  const token = required('GITHUB_TOKEN', process.env.GITHUB_TOKEN);
  const repoFull = required('DOCS_REPO', process.env.DOCS_REPO);
  const branchName = branch || process.env.DOCS_BRANCH || 'main';
  const [owner, repo] = repoFull.split('/');
  const octokit = new Octokit({ auth: token });

  // Obtener sha si ya existe
  let sha;
  try {
    const res = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref: branchName });
    sha = res.data.sha;
  } catch (_) { /* no existe, continuar */ }

  // Subir (o actualizar)
  const res = await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
    owner, repo, path,
    message: message || `Upload: ${path}`,
    content: contentBase64, branch: branchName,
    committer: author || { name: "Dealroom Bot", email: "bot@finsolar.mx" },
    author: author || { name: "Dealroom Bot", email: "bot@finsolar.mx" },
    sha
  });
  return { ok: true, commitSha: res.data.commit.sha };
}

export async function getGithubRawUrl({ path, branch }) {
  const token = required('GITHUB_TOKEN', process.env.GITHUB_TOKEN);
  const repoFull = required('DOCS_REPO', process.env.DOCS_REPO);
  const branchName = branch || process.env.DOCS_BRANCH || 'main';
  const [owner, repo] = repoFull.split('/');
  const octokit = new Octokit({ auth: token });

  const res = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', { owner, repo, path, ref: branchName });
  if (!res?.data?.download_url) throw new Error('NotFound');
  const size = Number(res?.data?.size ?? 0);
  if (!Number.isFinite(size)) {
    console.error('storage:getGithubRawUrl:invalid-size', { path, received: res?.data?.size });
    throw new Error('InvalidMetadata');
  }
  // Nota: el raw URL permite streaming con fetch nativo en Node 18
  return { downloadUrl: res.data.download_url, size };
}
