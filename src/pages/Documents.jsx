import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api, listDocs, getDocUrl } from '../lib/api'
import InvestorSlugPicker from '../components/InvestorSlugPicker'
import { resolveInvestorSlug } from '../lib/slug'
import { DOCUMENT_SECTIONS_ORDER } from '../constants/documents'
import { useToast } from '../lib/toast'
import { formatBytes } from '../lib/format'

export default function Documents(){
  const location = useLocation()
  const [loadingByCat, setLoadingByCat] = useState({})
  const [errorByCat, setErrorByCat] = useState({})
  const [filesByCat, setFilesByCat] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState(resolveInvestorSlug())
  const slugForDocs = useMemo(() => resolveInvestorSlug(), [location.search])
  const showToast = useToast()
  const [selectedFiles, setSelectedFiles] = useState({})
  const [uploadInputKeys, setUploadInputKeys] = useState({})

  const fetchDocs = useCallback(async (category) => {
    if (!slugForDocs){
      throw new Error('Slug no disponible para consultar documentos')
    }
    const res = await listDocs({ category, slug: slugForDocs })
    const files = Array.isArray(res?.files) ? res.files : []
    return files
  }, [slugForDocs])

  const refreshCategory = useCallback(async (category) => {
    setLoadingByCat(prev => ({ ...prev, [category]: true }))
    setErrorByCat(prev => ({ ...prev, [category]: '' }))
    try{
      const files = await fetchDocs(category)
      setFilesByCat(prev => ({ ...prev, [category]: files }))
      return files
    }catch(err){
      const message = err?.message || 'No se pudieron cargar documentos'
      setErrorByCat(prev => ({ ...prev, [category]: message }))
      setFilesByCat(prev => ({ ...prev, [category]: [] }))
      return []
    }finally{
      setLoadingByCat(prev => ({ ...prev, [category]: false }))
    }
  }, [fetchDocs])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    setErrorByCat({})
    setLoadingByCat({})
    if (!slugForDocs){
      setFilesByCat({})
      setLoading(false)
      setHasLoaded(true)
      setError('Slug no disponible para consultar documentos')
      return
    }
    try{
      await Promise.all(
        DOCUMENT_SECTIONS_ORDER.map((category) => refreshCategory(category))
      )
    }catch(err){
      setError(err?.message || 'No se pudieron cargar los documentos')
    }finally{
      setLoading(false)
      setHasLoaded(true)
    }
  }, [refreshCategory, slugForDocs])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    setSelectedSlug(resolveInvestorSlug())
  }, [location.hash])

  const handleFileChange = useCallback((category, file) => {
    setSelectedFiles(prev => ({ ...prev, [category]: file }))
    setError(null)
  }, [])

  const uploadCategory = useCallback(async (category) => {
    const file = selectedFiles[category]
    if (!file) return

    try{
      setUploadingCategory(category)
      setError(null)
      if (!slugForDocs){
        throw new Error('Slug no disponible para la carga')
      }
      await api.uploadDocument({
        slug: slugForDocs,
        category,
        file
      })
      await refreshCategory(category)
      showToast('Documento subido.', { tone: 'success' })
    }catch(err){
      const message = err?.message || 'Error al subir'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
    }finally{
      setUploadingCategory(null)
      setSelectedFiles(prev => ({ ...prev, [category]: null }))
      setUploadInputKeys(prev => ({ ...prev, [category]: (prev[category] || 0) + 1 }))
    }
  }, [refreshCategory, selectedFiles, showToast, slugForDocs])

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
        {DOCUMENT_SECTIONS_ORDER.map((category) => {
          const files = filesByCat[category] || []
          const catLoading = Boolean(loadingByCat[category])
          const catError = errorByCat[category]
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
                <table className="table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Archivo</th>
                      <th>Tamaño</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((d) => {
                      const displayName = d?.name || d?.filename || d?.path || ''
                      const slugForKey = slugForDocs || 'default'
                      const key = d?.path || `${category}/${slugForKey}/${displayName}`
                      const sizeBytes = typeof d?.size === 'number'
                        ? d.size
                        : typeof d?.sizeBytes === 'number'
                          ? d.sizeBytes
                          : typeof d?.sizeKB === 'number'
                            ? Math.round(d.sizeKB * 1024)
                            : null
                      const sizeLabel = typeof sizeBytes === 'number' && sizeBytes >= 0
                        ? formatBytes(sizeBytes)
                        : '—'
                      const rawPath = typeof d?.path === 'string' ? d.path.replace(/^\/+/, '') : ''
                      const pathParts = rawPath ? rawPath.split('/').filter(Boolean) : []
                      let filenameForUrl = typeof d?.filename === 'string' && d.filename
                        ? d.filename
                        : typeof d?.name === 'string' && d.name
                          ? d.name
                          : ''
                      if (!filenameForUrl && pathParts.length){
                        if (pathParts.length >= 4 && pathParts[0] === 'data' && pathParts[1] === 'docs'){
                          filenameForUrl = pathParts.slice(4).join('/') || pathParts[pathParts.length - 1] || ''
                        }else if (pathParts.length >= 3){
                          filenameForUrl = pathParts.slice(2).join('/') || pathParts[pathParts.length - 1] || ''
                        }else{
                          filenameForUrl = pathParts[pathParts.length - 1] || ''
                        }
                      }
                      const downloadUrl = slugForDocs && filenameForUrl
                        ? getDocUrl({ category, slug: slugForDocs, filename: filenameForUrl })
                        : null
                      return (
                        <tr key={key}>
                          <td>{displayName}</td>
                          <td>{sizeLabel}</td>
                          <td>
                            {downloadUrl ? (
                              <a
                                className="btn secondary"
                                href={downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Descargar
                              </a>
                            ) : (
                              <span className="help">Slug no disponible.</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {catError && (
                      <tr>
                        <td colSpan="3" style={{ color: 'red' }}>{catError}</td>
                      </tr>
                    )}
                    {catLoading && (
                      <tr>
                        <td colSpan="3">Cargando…</td>
                      </tr>
                    )}
                    {!catLoading && !catError && files.length === 0 && hasLoaded && (
                      <tr>
                        <td colSpan="3">No hay documentos aún.</td>
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
    </>
  )
}
