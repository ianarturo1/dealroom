import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, listDocs, getDocUrl } from '../lib/api'
import InvestorSlugPicker from '../components/InvestorSlugPicker'
import { resolveInvestorSlug } from '../lib/slug'
import { useToast } from '../lib/toast'

const CATEGORIES = [
  'NDA','Propuestas','Contratos','LOIs','Procesos',
  'Modelos financieros','Mitigación de riesgos','Sustento fiscal'
]

export default function Documents(){
  const location = useLocation()
  const [filesByCat, setFilesByCat] = useState({})
  const [errorByCat, setErrorByCat] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [selectedSlug, setSelectedSlug] = useState(resolveInvestorSlug())
  const showToast = useToast()
  const [selectedFiles, setSelectedFiles] = useState({})
  const [uploadInputKeys, setUploadInputKeys] = useState({})
  const lastSlugRef = useRef(resolveInvestorSlug() || '')

  const loadCategory = useCallback(async (category, slugForDocs) => {
    try {
      const res = await listDocs({ category, slug: slugForDocs })
      setFilesByCat(prev => ({ ...prev, [category]: res.files || [] }))
      setErrorByCat(prev => ({ ...prev, [category]: '' }))
    } catch (e) {
      setFilesByCat(prev => ({ ...prev, [category]: [] }))
      setErrorByCat(prev => ({ ...prev, [category]: e?.message || 'Error al listar' }))
    }
  }, [])

  const loadAll = useCallback(async () => {
    const slugForDocs = resolveInvestorSlug()
    if (!slugForDocs){
      setError('Slug no disponible para consultar documentos')
      setFilesByCat({})
      return
    }
    setError(null)
    setLoading(true)
    try {
      await Promise.all(CATEGORIES.map(cat => loadCategory(cat, slugForDocs)))
    } finally {
      setLoading(false)
    }
  }, [loadCategory])

  useEffect(() => {
    const s = resolveInvestorSlug()
    if (s){
      lastSlugRef.current = s
      setSelectedSlug(s)
      loadAll()
    }
  }, [loadAll])

  useEffect(() => {
    const s = resolveInvestorSlug()
    if (s && s !== lastSlugRef.current){
      lastSlugRef.current = s
      setSelectedSlug(s)
      setFilesByCat({})
      setErrorByCat({})
      loadAll()
    }
  }, [loadAll, location.hash])

  const handleFileChange = useCallback((category, file) => {
    setSelectedFiles(prev => ({ ...prev, [category]: file }))
    setError(null)
  }, [])

  const uploadCategory = useCallback(async (category) => {
    const file = selectedFiles[category]
    if (!file) return

    try {
      setUploadingCategory(category)
      setError(null)
      const slugForDocs = resolveInvestorSlug()
      if (!slugForDocs){
        throw new Error('Slug no disponible para la carga')
      }
      await api.uploadDocument({
        slug: slugForDocs,
        category,
        file
      })
      await loadCategory(category, slugForDocs)
      showToast('Documento subido.', { tone: 'success' })
    } catch (err) {
      const message = err?.message || 'Error al subir'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
    } finally {
      setUploadingCategory(null)
      setSelectedFiles(prev => ({ ...prev, [category]: null }))
      setUploadInputKeys(prev => ({ ...prev, [category]: (prev[category] || 0) + 1 }))
    }
  }, [loadCategory, selectedFiles, showToast])

  const handleUpload = useCallback((category) => async (e) => {
    e.preventDefault()
    await uploadCategory(category)
  }, [uploadCategory])

  return (
    <>
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="h1">Biblioteca de documentos</div>
        {/*
        <InvestorSlugPicker
          value={selectedSlug}
          onChange={() => {
            // ya que el picker escribe /#/?slug=<...>, solo recargamos
            loadAll()
          }}
        />
        */}
        <button className="btn" onClick={() => loadAll()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {error && <div className="notice" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 12, display: 'grid', gap: 24 }}>
        {CATEGORIES.map((category) => {
          const docs = filesByCat[category] || []
          const selectedFile = selectedFiles[category] || null
          const isUploading = uploadingCategory === category
          return (
            <section key={category}>
              <h2 className="h2" style={{ marginBottom: 8 }}>{category}</h2>
              <div className="card" style={{ padding: 0 }}>
                <form
                  onSubmit={handleUpload(category)}
                  className="form-row"
                  style={{ padding: 16, borderBottom: '1px solid #f0f0f0' }}
                  aria-busy={isUploading}
                >
                  <input
                    key={uploadInputKeys[category] || 0}
                    name="file"
                    type="file"
                    className="input"
                    disabled={isUploading}
                    onChange={(e) => handleFileChange(category, e.target.files?.[0] || null)}
                  />
                  <button className="btn" type="submit" disabled={isUploading || !selectedFile}>
                    {isUploading ? 'Subiendo…' : 'Subir archivo'}
                  </button>
                </form>
                <div style={{ padding: 16, display: 'grid', gap: 8 }}>
                  {docs.length === 0 && !errorByCat[category] && !loading && (
                    <div>No hay documentos aún.</div>
                  )}
                  {docs.length === 0 && loading && (
                    <div>Cargando…</div>
                  )}
                  {(docs || []).map(f => {
                    const url = getDocUrl({ category: category, slug: resolveInvestorSlug(), filename: f.name })
                    return (
                      <div className="row" key={f.name} style={{ alignItems: 'center' }}>
                        <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ width: 120 }}>{f.size || ''}</div>
                        <a className="btn" href={url} target="_blank" rel="noreferrer">Descargar</a>
                      </div>
                    )
                  })}

                  {errorByCat[category] && (
                    <div style={{ color: '#b00', marginTop: 8 }}>{errorByCat[category]}</div>
                  )}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
    </>
  )
}
