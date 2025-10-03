import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '@/lib/api'
import { resolveInvestorSlug } from '@/lib/slug'
import { DOCUMENT_SECTIONS_ORDER } from '../constants/documents'
import { useToast } from '../lib/toast'

export default function Documents(){
  const location = useLocation()
  const [docsByCategory, setDocsByCategory] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const slugForDocs = useMemo(() => resolveInvestorSlug(), [location.search])
  const showToast = useToast()
  const [selectedFiles, setSelectedFiles] = useState({})
  const [uploadInputKeys, setUploadInputKeys] = useState({})
  const [downloadingDocId, setDownloadingDocId] = useState(null)

  const fetchDocs = useCallback(async (category) => {
    if (!slugForDocs){
      return []
    }
    const res = await api.listDocs({ category, slug: slugForDocs })
    const files = Array.isArray(res?.files) ? res.files : []
    return files
  }, [slugForDocs])

  const refreshCategory = useCallback(async (category) => {
    const files = await fetchDocs(category)
    setDocsByCategory(prev => ({ ...prev, [category]: files }))
    return files
  }, [fetchDocs])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (!slugForDocs){
      setDocsByCategory({})
      setLoading(false)
      setHasLoaded(true)
      setError('Slug no disponible para consultar documentos')
      return
    }
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
  }, [fetchDocs, slugForDocs])

  useEffect(() => {
    loadAll()
  }, [loadAll])

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

  const handleDownload = useCallback(async (category, doc, docKey) => {
    if (!slugForDocs){
      const message = 'Slug no disponible para la descarga'
      showToast(message, { tone: 'error', duration: 5000 })
      return
    }

    const fallbackName = (doc?.path || '').split('/').filter(Boolean).pop()
    const filename = (doc?.filename || doc?.name || fallbackName || '').trim()

    if (!filename){
      const message = 'Nombre de archivo no disponible'
      showToast(message, { tone: 'error', duration: 5000 })
      return
    }

    try{
      setDownloadingDocId(docKey)
      await api.downloadDocument({
        slug: slugForDocs,
        category,
        filename,
        disposition: doc?.canPreview ? 'inline' : 'attachment'
      })
    }catch(err){
      const message = err?.message || 'No se pudo descargar el archivo'
      showToast(message, { tone: 'error', duration: 5000 })
    }finally{
      setDownloadingDocId(null)
    }
  }, [showToast, slugForDocs])

  return (
    <>
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="h1">Biblioteca de documentos</div>
        <button className="btn" onClick={() => loadAll()} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>
      {error && <div className="notice" style={{ marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 12, display: 'grid', gap: 24 }}>
        {DOCUMENT_SECTIONS_ORDER.map((category) => {
          const docs = docsByCategory[category] || []
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
                    {docs.map((d) => {
                      const filename = d.name || d.filename || d.path || ''
                      const sizeBytes = typeof d.size === 'number'
                        ? d.size
                        : typeof d.sizeBytes === 'number'
                          ? d.sizeBytes
                          : typeof d.sizeKB === 'number'
                            ? Math.round(d.sizeKB * 1024)
                            : 0
                      const sizeLabel = sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : '0.0 KB'
                      const slugForKey = slugForDocs || 'default'
                      const key = d.path || `${category}/${slugForKey}/${filename}`
                      const isDownloading = downloadingDocId === key
                      return (
                        <tr key={key}>
                          <td>{filename}</td>
                          <td>{sizeLabel}</td>
                          <td>
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => handleDownload(category, d, key)}
                              disabled={isDownloading}
                            >
                              {isDownloading ? 'Descargando…' : 'Descargar'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
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
    </>
  )
}
