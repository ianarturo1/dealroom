import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useInvestorProfile } from '../lib/investor'

export default function Documents(){
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState('NDA')
  const [error, setError] = useState(null)
  const { investorId } = useInvestorProfile()

  async function load(){
    try{
      setLoading(true); setError(null)
      const res = await api.listDocs({ category, slug: investorId })
      setDocs(res.files || [])
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }
  useEffect(() => { load() }, [category, investorId])

  async function onUpload(e){
    e.preventDefault()
    const file = e.target.file.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try{
        setLoading(true); setError(null)
        const contentBase64 = reader.result.split(',')[1]
        await api.uploadDoc({
          path: `${category}`,
          filename: file.name,
          message: `Upload ${file.name} from Dealroom UI`,
          contentBase64,
          slug: investorId
        })
        await load()
        alert('Archivo subido')
      }catch(err){ setError(err.message) }
      finally{ setLoading(false) }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="container">
      <div className="row" style={{justifyContent:'space-between'}}>
        <div className="h1">Biblioteca de documentos</div>
        <div className="form-row" style={{maxWidth:420}}>
          <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
            <option>NDA</option>
            <option>Propuestas</option>
            <option>Modelos financieros</option>
            <option>Contratos</option>
            <option>LOIs</option>
            <option>Sustento fiscal</option>
            <option>Mitigación de riesgos</option>
            <option>Procesos</option>
          </select>
          <button className="btn" onClick={load}>Actualizar</button>
        </div>
      </div>

      <div className="card">
        <form onSubmit={onUpload} className="form-row">
          <input name="file" type="file" className="input" />
          <button className="btn" type="submit">Subir</button>
          <span className="notice">Los archivos se guardan en GitHub y se exponen públicamente.</span>
        </form>
      </div>

      {error && <div className="notice" style={{marginTop:12}}>{error}</div>}
      {loading && <p>Cargando…</p>}
      <table className="table" style={{marginTop:12}}>
        <thead><tr><th>Archivo</th><th>Tamaño</th><th></th></tr></thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.path}>
              <td>{d.name}</td>
              <td>{(d.size/1024).toFixed(1)} KB</td>
              <td>
                <a className="btn secondary" href={api.downloadDocPath(d.path)}>Descargar</a>
              </td>
            </tr>
          ))}
          {docs.length === 0 && !loading && <tr><td colSpan="3">No hay documentos aún.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
