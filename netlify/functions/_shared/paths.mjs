// _shared/paths.mjs (Node 18 ESM)
export const trim = s => String(s).replace(/^\/+|\/+$/g,'');
export const joinPath = (...p) => p.filter(Boolean).map(trim).join('/').replace(/\/+/g,'/');
export const stripDealroom = s => {
  let out = trim(String(s));
  // quita cualquier "dealroom" al inicio (una o dos veces)
  out = out.replace(/^dealroom\/?/i,'');
  out = out.replace(/^dealroom\/?/i,'');
  return trim(out);
};
export const sanitize = (s='') =>
  String(s).normalize('NFKC').replace(/[^\p{L}\p{N}._() \-]/gu,'').trim();

export function baseDir() {
  const RAW_BASE =
    process.env.DOCS_ROOT_DIR ??
    process.env.DOCS_BASE_DIR ??
    process.env.CONTENT_ROOT_DIR ??
    '';
  return stripDealroom(RAW_BASE); // nunca debe empezar con "dealroom"
}

export function buildNewLayoutPath(category, slug) {
  const cat = sanitize(category);
  const s = sanitize(slug).toLowerCase();
  // <base>/<category>/<slug>
  return stripDealroom(joinPath(baseDir(), cat, s));
}

export function buildLegacyPath(category, slug) {
  const cat = sanitize(category);
  const s = sanitize(slug).toLowerCase();
  // data/docs/<slug>/<category>
  return joinPath('data/docs', s, cat);
}
