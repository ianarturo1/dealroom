import React, { useState } from 'react';
import { getInvestor, updateInvestor, deleteInvestor } from '../services/investors';

export default function Admin() {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('LOI');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleLoad = async () => {
    setLoading(true); setMsg('');
    try {
      const inv = await getInvestor(slug.trim());
      if (!inv) { setMsg('No encontrado'); return; }
      setName(inv.name || '');
      setStatus(inv.status || 'LOI');
      setMsg('Datos cargados');
    } catch (e) {
      setMsg('Error al cargar');
    } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setLoading(true); setMsg('');
    try {
      await updateInvestor({
        id: slug.trim(),
        name: name.trim(),
        status
      });
      setMsg('Actualizado');
    } catch (e) {
      setMsg('Error al guardar');
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar inversionista y su JSON?')) return;
    setLoading(true); setMsg('');
    try {
      await deleteInvestor(slug.trim());
      setMsg('Eliminado');
    } catch (e) {
      setMsg('Error al eliminar');
    } finally { setLoading(false); }
  };

  const handleOpenPanel = () => {
    const s = slug.trim();
    if (!s) return;
    window.open(`/#/?investor=${encodeURIComponent(s)}`, '_blank');
  };

  return (
    <div className="container" style={{maxWidth: 980, margin: '24px auto'}}>
      <h2 style={{marginBottom: 16}}>Actualizar estado de inversionista</h2>

      <div className="grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12}}>
        <label>
          <div>Slug (id)</div>
          <input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="femsa" />
        </label>
        <label>
          <div>Nombre</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="FEMSA" />
        </label>
        <label>
          <div>Estado</div>
          <select value={status} onChange={e=>setStatus(e.target.value)}>
            <option>LOI</option>
            <option>Due Diligence</option>
            <option>Revisión de contratos</option>
            <option>Firma</option>
          </select>
        </label>
      </div>

      <div style={{marginTop:12, display:'flex', gap:12, flexWrap:'wrap'}}>
        <button disabled={loading} onClick={handleLoad}>Cargar datos</button>
        <button disabled={loading} onClick={handleOpenPanel}>Ver panel</button>
        <button disabled={loading} onClick={handleDelete}>Eliminar</button>
        <button disabled={loading} onClick={handleSave}>Guardar</button>
      </div>

      {msg && <p style={{marginTop:8}}>{msg}</p>}
    </div>
  );
}
