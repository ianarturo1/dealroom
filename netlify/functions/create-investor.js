const jwt = require("jsonwebtoken");

const { GITHUB_TOKEN, CONTENT_REPO, CONTENT_BRANCH = "main", SIGNING_SECRET, SITE_URL } = process.env;

const GH_API = "https://api.github.com";

const jsonResponse = (statusCode, data) => ({
  statusCode,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(data),
});

async function gh(path, init = {}) {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      authorization: `token ${GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text}`);
  }
  return res;
}

async function getFile(path) {
  const res = await fetch(`${GH_API}/repos/${CONTENT_REPO}/contents/${encodeURIComponent(path)}?ref=${CONTENT_BRANCH}`, {
    headers: {
      authorization: `token ${GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

async function putFile(path, contentObj, message) {
  const existing = await getFile(path);
  const body = {
    message,
    content: Buffer.from(JSON.stringify(contentObj, null, 2)).toString("base64"),
    branch: CONTENT_BRANCH,
    ...(existing ? { sha: existing.sha } : {}),
  };
  await gh(`/repos/${CONTENT_REPO}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return jsonResponse(405, { ok: false, error: "Method not allowed" });

    if (!GITHUB_TOKEN || !CONTENT_REPO || !SIGNING_SECRET || !SITE_URL) {
      return jsonResponse(500, { ok: false, error: "Missing env vars (GITHUB_TOKEN, CONTENT_REPO, SIGNING_SECRET, SITE_URL)" });
    }

    const body = JSON.parse(event.body || "{}");
    const email = (body.email || "").trim().toLowerCase();
    const companyName = (body.companyName || "").trim();
    const slug = (body.slug || body.companyName || "").toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/(^-|-$)/g, "");
    const status = body.status || "NDA";

    if (!email || !companyName || !slug) {
      return jsonResponse(400, { ok: false, error: "email, companyName y slug son requeridos" });
    }

    const investorDoc = {
      id: slug,
      name: companyName,
      email,
      status,
      createdAt: new Date().toISOString(),
    };
    await putFile(`data/investors/${slug}.json`, investorDoc, `chore(investor): upsert ${slug}`);

    let index = { investors: {} };
    const indexPath = "data/investor-index.json";
    const existingIndex = await getFile(indexPath);
    if (existingIndex) {
      try {
        index = JSON.parse(Buffer.from(existingIndex.content, "base64").toString("utf8"));
        if (!index.investors) index.investors = {};
      } catch {
        index = { investors: {} };
      }
    }
    index.investors[slug] = { name: companyName, email, status };
    await putFile(indexPath, index, `chore(index): upsert ${slug}`);

    const token = jwt.sign({ sub: slug, aud: "investor" }, SIGNING_SECRET, { expiresIn: "7d" });
    const base = SITE_URL.replace(/\/$/, "");
    const link = `${base}/i/${slug}?t=${token}`;

    return jsonResponse(200, { ok: true, slug, link });
  } catch (err) {
    return jsonResponse(500, { ok: false, error: String(err && err.message || err) });
  }
};
