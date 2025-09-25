import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useInvestorProfile } from '../lib/investor'
import { DOCUMENT_SECTIONS_ORDER } from '../constants/documents'

export default function Documents(){
  const [docsByCategory, setDocsByCategory] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const { investorId } = useInvestorProfile()

  const fetchDocs = useCallback(async (category) => {
    const res = await api.listDocs({ category, slug: investorId })
    const files = Array.isArray(res?.files) ? res.files : []
    return files
  }, [investorId])

  const refreshCategory = useCallback(async (category) => {
    const files = await fetchDocs(category)
    setDocsByCategory(prev => ({ ...prev, [category]: files }))
    return files
  }, [fetchDocs])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try{
      const results = await Promise.allSettled(
        DOCUMENT_SECTIONS_ORDER.map(async (category) => {
          const files = await fetchDocs(category)
          return [category, files]
        })
      )
      const next = {}
      const errors = []
      results.forEach((result, index) => {
        const fallbackCategory = DOCUMENT_SECTIONS_ORDER[index]
        if (result.status === 'fulfilled'){
          const [category, files] = result.value
          next[category] = files
        }else{
          const message = result.reason?.message || 'Error desconocido'
          next[fallbackCategory] = []
          errors.push(`${fallbackCategory}: ${message}`)
        }
      })
      setDocsByCategory(next)
      if (errors.length){
        const suffix = errors.length === 1 ? '' : 's'
        setError(`No se pudieron cargar ${errors.length} categoría${suffix}.`)
      }
    }catch(err){
      setDocsByCategory({})
      setError(err.message)
    }finally{
      setLoading(false)
      setHasLoaded(true)
    }
  }, [fetchDocs])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleUpload = useCallback((category) => (e) => {
    e.preventDefault()
    setError(null)
    const form = e.target
    const fileInput = form.file
    const file = fileInput && fileInput.files ? fileInput.files[0] : null
    if (!file) return
    const reader = new FileReader()
    setUploadingCategory(category)
    reader.onload = async () => {
      try{
        const result = typeof reader.result === 'string' ? reader.result : ''
        const contentBase64 = result.includes(',') ? result.split(',')[1] : ''
        if (!contentBase64) throw new Error('No se pudo leer el archivo')
        await api.uploadDoc({
          path: `${category}`,
          filename: file.name,
          message: `Upload ${file.name} from Dealroom UI`,
          contentBase64,
          slug: investorId
        })
        form.reset()
        await refreshCategory(category)
        alert('Archivo subido')
      }catch(err){
        setError(err.message)
      }finally{
        setUploadingCategory(null)
      }
    }
    reader.onerror = () => {
      setUploadingCategory(null)
      setError('No se pudo leer el archivo')
    }
    reader.readAsDataURL(file)
  }, [investorId, refreshCategory])

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="h1">Biblioteca de documentos</div>
        <button className="btn" onClick={() => loadAll()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <span className="notice">Los archivos se guardan en GitHub y se exponen públicamente.</span>
      </div>

      {error && <div className="notice" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 12, display: 'grid', gap: 24 }}>
        {DOCUMENT_SECTIONS_ORDER.map((category) => {
          const docs = docsByCategory[category] || []
          const isUploading = uploadingCategory === category
          return (
            <section key={category}>
              <h2 className="h2" style={{ marginBottom: 8 }}>{category}</h2>
              <div className="card" style={{ padding: 0 }}>
                <form onSubmit={handleUpload(category)} className="form-row" style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}>
                  <input name="file" type="file" className="input" disabled={isUploading} />
                  <button className="btn" type="submit" disabled={isUploading}>
                    {isUploading ? 'Subiendo…' : 'Subir'}
                  </button>
                </form>
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Tamaño</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.path}>
                        <td>{d.name}</td>
                        <td>{(d.size / 1024).toFixed(1)} KB</td>
                        <td>
                          <a className="btn secondary" href={api.downloadDocPath(d.path)}>Descargar</a>
                        </td>
                      </tr>
                    ))}
                    {docs.length === 0 && hasLoaded && !loading && (
                      <tr>
                        <td colSpan="3">No hay documentos aún.</td>
                      </tr>
                    )}
                    {docs.length === 0 && loading && (
                      <tr>
                        <td colSpan="3">Cargando…</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
