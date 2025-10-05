import { useEffect, useMemo, useState, useCallback } from 'react';
import * as api from '../lib/api';
import { setSlugInHash } from '../lib/slug';

export default function InvestorSlugPicker({ value, onChange }) {
  const [investors, setInvestors] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listInvestors();
        setInvestors(Array.isArray(res?.items) ? res.items : []);
      } catch {}
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    if (!q) return investors;
    return investors.filter(i =>
      (i?.slug || '').toLowerCase().includes(q) ||
      (i?.name || '').toLowerCase().includes(q)
    );
  }, [investors, search]);

  const apply = useCallback((slug) => {
    if (!slug) return;
    setSlugInHash(slug);      // escribe /#/?slug=<slug> sin recargar
    onChange?.(slug);         // deja que el contenedor recargue
  }, [onChange]);

  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      <input
        className="input"
        placeholder="Buscar inversionista por slug o nombre…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ minWidth:260 }}
      />
      <select
        className="input"
        value={value || ''}
        onChange={(e) => apply(e.target.value)}
        style={{ minWidth:260 }}
      >
        <option value="">Selecciona inversionista…</option>
        {filtered.map(i => (
          <option key={i.slug} value={i.slug}>
            {i.slug} — {i.name || 'Sin nombre'}
          </option>
        ))}
      </select>
    </div>
  );
}
