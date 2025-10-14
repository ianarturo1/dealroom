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
export function ensureSlugAllowed(inputSlug, _event) {
  const asked = sanitizeSegment(inputSlug).toLowerCase();
  if (!asked) throw httpError(400, "Missing slug");
  if (asked.includes("..")) throw httpError(400, "Invalid slug");

  const isPreview = (process.env.CONTEXT || "").toLowerCase() === "deploy-preview";
  const adminBypass = (process.env.ADMIN_BYPASS_ALL_SLUGS || "").toLowerCase() === "true";

  if (isPreview || adminBypass) {
    return asked; // Admin / preview: no restringir
  }

  const singleSlug = sanitizeSegment(process.env.PUBLIC_INVESTOR_SLUG || "").toLowerCase();
  const multipleSlugsRaw = String(process.env.PUBLIC_INVESTOR_SLUGS || "");
  const slugList = multipleSlugsRaw
    .split(",")
    .map((value) => sanitizeSegment(value).toLowerCase())
    .filter(Boolean);

  const allowsAll = slugList.includes("*");
  if (allowsAll) {
    return asked;
  }

  const allowedSet = new Set(slugList);
  if (singleSlug) {
    allowedSet.add(singleSlug);
  }

  if (allowedSet.size === 0) {
    return asked;
  }

  if (allowedSet.has(asked)) {
    return asked;
  }

  throw httpError(403, "Slug not allowed");
}
