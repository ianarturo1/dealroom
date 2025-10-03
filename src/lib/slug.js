export function resolveInvestorSlug() {
  const qs = new URLSearchParams(window.location.search).get('slug');
  if (qs && qs.trim()) return qs.trim().toLowerCase();
  const env = import.meta.env.VITE_PUBLIC_INVESTOR_ID || '';
  return env.trim().toLowerCase();
}
