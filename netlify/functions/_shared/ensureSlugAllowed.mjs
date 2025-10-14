/* netlify/functions/_shared/ensureSlugAllowed.mjs */
export function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export function sanitizeSegment(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._() \-]/gu, "")
    .trim();
}

// Nota: mantenemos compatibilidad hacia atrás con PUBLIC_INVESTOR_SLUG (singular)
// y añadimos PUBLIC_INVESTOR_SLUGS (lista separada por comas) y wildcard "*"/"all".
function parseAllowedSlugs() {
  const singular = String(process.env.PUBLIC_INVESTOR_SLUG || "").trim();
  const plural = String(process.env.PUBLIC_INVESTOR_SLUGS || "").trim();

  const raw = [singular, plural].filter(Boolean).join(",");
  if (!raw) return new Set(); // sin restricción

  const parts = raw
    .split(",")
    .map((v) => sanitizeSegment(v).toLowerCase())
    .filter(Boolean);

  if (parts.includes("*") || parts.includes("all")) {
    return new Set(["*"]);
  }
  return new Set(parts);
}

/**
 * Política de acceso a slugs:
 * - En deploy previews o si ADMIN_BYPASS_ALL_SLUGS=true => sin restricción.
 * - Si PUBLIC_INVESTOR_SLUG(S) no está definida => sin restricción.
 * - Si PUBLIC_INVESTOR_SLUG(S) está definida:
 *     - '*' o 'all' => sin restricción.
 *     - lista separada por comas => permitir sólo esos slugs (case-insensitive).
 */
export function ensureSlugAllowed(inputSlug) {
  const asked = sanitizeSegment(inputSlug).toLowerCase();

  const isPreview = (process.env.CONTEXT || "").toLowerCase() === "deploy-preview";
  const adminBypass = (process.env.ADMIN_BYPASS_ALL_SLUGS || "").toLowerCase() === "true";
  if (isPreview || adminBypass) return asked;

  const allowed = parseAllowedSlugs(); // Set
  if (allowed.size === 0 || allowed.has("*")) return asked;

  if (!asked) {
    throw httpError(400, "Missing slug");
  }
  if (!allowed.has(asked)) {
    throw httpError(403, "Slug not allowed");
  }
  return asked;
}
