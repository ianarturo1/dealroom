// _shared/paths.mjs (Node 18 ESM)

/**
 * Une múltiples partes de una ruta en un solo string, eliminando barras duplicadas.
 * @param {...string} p - Las partes de la ruta a unir.
 * @returns {string}
 */
function joinPath(...p) {
  // Normaliza y une las partes, eliminando barras duplicadas.
  return p.map(part => String(part).trim().replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

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
 * Construye la ruta estandarizada y absoluta para un documento dentro del repositorio.
 * La estructura final siempre será: `dealroom/<categoría>/<slug>`.
 *
 * @param {string} category - La categoría del documento (ej. "NDA", "Propuestas").
 * @param {string} slug - El slug del inversionista o proyecto.
 * @returns {string} - La ruta completa y normalizada desde la raíz del repo.
 */
export function buildDocumentPath(category, slug) {
  const basePath = 'dealroom';
  const cat = sanitize(category);
  const s = sanitize(slug).toLowerCase();

  // Se asegura de que la ruta sea siempre absoluta desde la raíz del repo.
  return joinPath(basePath, cat, s);
}

// Re-exportar joinPath para que otras funciones puedan usarlo si es necesario.
export { joinPath };