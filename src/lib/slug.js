// src/lib/slug.js
export function resolveInvestorSlug() {
  // 1) ?slug=... o ?investor=... en búsqueda "normal"
  const searchQs = new URLSearchParams(window.location.search || '');
  const fromSearch = searchQs.get('slug') || searchQs.get('investor');

  // 2) ?slug=... o ?investor=... dentro del hash (HashRouter: /#/?slug=...)
  let fromHash = '';
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex !== -1) {
    const hashQs = new URLSearchParams(hash.slice(qIndex + 1));
    fromHash = hashQs.get('slug') || hashQs.get('investor') || '';
  }

  // 3) Fallback a env del frontend
  const env = (import.meta.env.VITE_PUBLIC_INVESTOR_ID || '').trim();

  return (fromSearch || fromHash || env || '').trim().toLowerCase();
}

// Actualiza la URL del HashRouter a /#/?slug=<slug>, preservando otros params
export function setSlugInHash(nextSlug) {
  const url = new URL(window.location.href);
  const base = url.origin + url.pathname + '#/';
  const paramsStr = window.location.hash.split('?')[1] || '';
  const params = new URLSearchParams(paramsStr);
  if (nextSlug) params.set('slug', String(nextSlug).toLowerCase());
  const next = base + '?' + params.toString();
  window.history.replaceState(null, '', next);
}
