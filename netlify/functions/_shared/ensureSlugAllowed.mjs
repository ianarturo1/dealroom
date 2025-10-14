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

/**
 * Política de acceso a slugs:
 * - En deploy-preview (process.env.CONTEXT === "deploy-preview") -> permitir cualquier slug.
 * - O si ADMIN_BYPASS_ALL_SLUGS === "true" -> permitir cualquier slug.
 * - En caso contrario (producción/branch deploy sin bypass):
 *     Si PUBLIC_INVESTOR_SLUG está definido, solo se permite ese slug (case-insensitive).
 *     Si no está definido, se permite el slug solicitado.
 */
export function ensureSlugAllowed(inputSlug) {
  const asked = sanitizeSegment(inputSlug).toLowerCase();
  if (!asked) throw httpError(400, "Missing slug");

  const isPreview = (process.env.CONTEXT || "").toLowerCase() === "deploy-preview";
  const adminBypass = (process.env.ADMIN_BYPASS_ALL_SLUGS || "").toLowerCase() === "true";

  if (isPreview || adminBypass) {
    return asked; // Admin / preview: no restringir
  }

  const envSlug = sanitizeSegment(process.env.PUBLIC_INVESTOR_SLUG || "").toLowerCase();
  if (envSlug && asked !== envSlug) {
    throw httpError(403, "Slug not allowed");
  }
  return asked || envSlug;
}
