// src/services/investors.js
// Capa simple para CRUD de inversionistas vía Netlify Functions

async function call(fn, { method = 'POST', body } = {}) {
  const res = await fetch(`/.netlify/functions/${fn}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${fn} failed (${res.status}): ${txt}`);
  }
  // Algunas fns pueden devolver 204 sin body
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return null;
}

export async function getInvestor(id) {
  if (!id) throw new Error('id requerido');
  const r = await call('get-investor', { method: 'POST', body: { id } });
  return r; // { id, name, status, ... }
}

export async function updateInvestor({ id, name, status }) {
  if (!id) throw new Error('id requerido');
  return call('update-investor', { method: 'POST', body: { id, name, status } });
}

export async function deleteInvestor(id) {
  if (!id) throw new Error('id requerido');
  return call('delete-investor', { method: 'POST', body: { id } });
}

