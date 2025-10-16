// _shared/paths.mjs (Node 18 ESM)

/**
 * Elimina las barras iniciales y finales de un string.
 * @param {string} s
 * @returns {string}
 */
export const trim = s => String(s).replace(/^\/+|\/+$/g, '');

/**
 * Une múltiples partes de una ruta en un solo string, eliminando barras duplicadas.
 * @param {...string} p - Las partes de la ruta a unir.
 * @returns {string}
 */
export const joinPath = (...p) => p.filter(Boolean).map(trim).join('/').replace(/\/+/g, '/');

/**
 * Limpia un string para usarlo como parte de una ruta, eliminando caracteres no seguros.
 * @param {string} s
 * @returns {string}
 */
export const sanitize = (s = '') =>
  String(s)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._() \-]/gu, '')
    .trim();

/**
 * Construye la ruta estandarizada para un documento dentro del repositorio.
 * La estructura final siempre será: `dealroom/<categoría>/<slug>`.
 *
 * @param {string} category - La categoría del documento (ej. "NDA", "Propuestas").
 * @param {string} slug - El slug del inversionista o proyecto.
 * @returns {string} - La ruta completa y normalizada.
 */
export function buildDocumentPath(category, slug) {
  const basePath = 'dealroom'; // Simple, predictable, no environment variables.
  const cat = sanitize(category);
  const s = sanitize(slug).toLowerCase();
  return joinPath(basePath, cat, s);
}