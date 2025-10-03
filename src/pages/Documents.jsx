import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { useInvestorProfile } from '../lib/investor'
import { DOCUMENT_SECTIONS_ORDER } from '../constants/documents'
import { useToast } from '../lib/toast'
import { modalBackdropStyle, modalCardStyle, modalButtonRowStyle } from '../components/modalStyles'

export default function Documents(){
  const [docsByCategory, setDocsByCategory] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const { investorId } = useInvestorProfile()
  const normalizedInvestorId = useMemo(() => (investorId || '').trim().toLowerCase(), [investorId])
  const alseaSlug = 'alsea'
  const isAlseaContext = normalizedInvestorId === alseaSlug
  const slugForDocs = useMemo(() => (isAlseaContext ? alseaSlug : investorId), [alseaSlug, investorId, isAlseaContext])
  const showToast = useToast()
  const [pendingUpload, setPendingUpload] = useState(null)
  const [renamePrompt, setRenamePrompt] = useState(null)

  const fetchDocs = useCallback(async (category) => {
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

  const performUpload = useCallback(async (uploadInfo, options = {}) => {
    if (!uploadInfo || !uploadInfo.file) return null
    setError(null)
    setUploadingCategory(uploadInfo.category)
    try{
      const formData = new FormData()
      formData.set('slug', uploadInfo.slug)
      formData.set('category', uploadInfo.category)
      formData.set('filename', uploadInfo.filename)
      if (options.strategy === 'rename'){
        formData.set('strategy', 'rename')
      }
      formData.set('file', uploadInfo.file, uploadInfo.filename)
      const response = await api.uploadDoc(formData)
      await refreshCategory(uploadInfo.category)
      const successMsg = options.strategy === 'rename'
        ? 'Documento subido con sufijo automático.'
        : 'Documento subido.'
      showToast(successMsg, { tone: 'success' })
      uploadInfo.form?.reset?.()
      setPendingUpload(null)
      setRenamePrompt(null)
      return response
    }catch(err){
      if (err?.status === 409 && err?.data?.error === 'FILE_EXISTS' && options.strategy !== 'rename'){
        const fallbackPath = `data/docs/${uploadInfo.slug}/${uploadInfo.category}/${uploadInfo.filename}`
        setPendingUpload(uploadInfo)
        setRenamePrompt({ path: err.data?.path || fallbackPath, category: uploadInfo.category })
        return null
      }
      const message = err?.message || 'No se pudo subir el archivo'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
      return null
    }finally{
      setUploadingCategory(null)
    }
  }, [refreshCategory, showToast])

  const handleUpload = useCallback((category) => async (e) => {
    e.preventDefault()
    setError(null)
    setPendingUpload(null)
    setRenamePrompt(null)
    const form = e.target
    const fileInput = form.file
    const file = fileInput && fileInput.files ? fileInput.files[0] : null
    if (!file) return
    const uploadSlug = slugForDocs
    if (!uploadSlug){
      const message = 'Slug no disponible para la carga'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
      return
    }
    await performUpload({
      category,
      filename: file.name,
      slug: uploadSlug,
      form,
      file
    })
  }, [performUpload, showToast, slugForDocs])

  const handleConfirmRename = useCallback(async () => {
    if (!pendingUpload){
      setRenamePrompt(null)
      return
    }
    await performUpload(pendingUpload, { strategy: 'rename' })
  }, [pendingUpload, performUpload])

  const handleCancelRename = useCallback(() => {
    setPendingUpload(null)
    setRenamePrompt(null)
  }, [])

  const renameBusy = renamePrompt ? uploadingCategory === renamePrompt.category : false

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
                      const slugForKey = slugForDocs || normalizedInvestorId || investorId || 'default'
                      const key = d.path || `${category}/${slugForKey}/${filename}`
                      const slugForLink = slugForDocs || alseaSlug
                      const href = d.path
                        ? api.downloadDocPath(d.path)
                        : api.docDownloadUrl({ category, slug: slugForLink, filename })
                      return (
                        <tr key={key}>
                          <td>{filename}</td>
                          <td>{sizeLabel}</td>
                          <td>
                            <a className="btn secondary" href={href}>Descargar</a>
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
    {renamePrompt && (
      <div style={modalBackdropStyle} role="dialog" aria-modal="true" aria-labelledby="doc-rename-modal">
        <div style={modalCardStyle}>
          <div className="h2" id="doc-rename-modal" style={{ marginTop: 0 }}>Archivo duplicado</div>
          <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
            Ya existe un archivo con ese nombre. ¿Quieres subirlo con un sufijo automático?
          </p>
          <p style={{ fontSize: 13 }}>
            <code>{renamePrompt.path}</code>
          </p>
          <div style={modalButtonRowStyle}>
            <button
              type="button"
              className="btn secondary"
              onClick={handleCancelRename}
              disabled={renameBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleConfirmRename}
              disabled={renameBusy}
              aria-busy={renameBusy}
            >
              {renameBusy ? 'Subiendo…' : 'Renombrar y subir'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
