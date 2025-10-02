import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../lib/api'
import { useInvestorProfile } from '../lib/investor'
import { DOCUMENT_SECTIONS_ORDER } from '../constants/documents'
import { useToast } from '../lib/toast'
import { modalBackdropStyle, modalCardStyle, modalButtonRowStyle } from '../components/modalStyles'

const HASH_QUERY_REGEX = /\?/;

function extractSlugFromHash(hash){
  if (!hash || !HASH_QUERY_REGEX.test(hash)) return ''
  const query = hash.slice(hash.indexOf('?') + 1)
  if (!query) return ''
  const params = new URLSearchParams(query)
  const candidate = params.get('investor')
  return candidate ? candidate.trim().toLowerCase() : ''
}

function toBase64(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string'){
        reject(new Error('No se pudo leer el archivo'))
        return
      }
      const commaIndex = result.indexOf(',')
      const base64 = (commaIndex >= 0 ? result.slice(commaIndex + 1) : result).trim()
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onabort = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export default function Documents(){
  const [docsByCategory, setDocsByCategory] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadingCategory, setUploadingCategory] = useState(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState({})
  const { investorId } = useInvestorProfile()
  const location = useLocation()
  const showToast = useToast()
  const [pendingUpload, setPendingUpload] = useState(null)
  const [renamePrompt, setRenamePrompt] = useState(null)

  const envSlug = useMemo(() => {
    const raw = import.meta.env.VITE_PUBLIC_INVESTOR_ID
    return typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  }, [])

  const searchSlug = useMemo(() => {
    const search = location.search || ''
    if (!search) return ''
    const params = new URLSearchParams(search)
    const candidate = params.get('investor')
    return candidate ? candidate.trim().toLowerCase() : ''
  }, [location.search])

  const hashSlug = useMemo(() => extractSlugFromHash(location.hash), [location.hash])

  const resolvedSlug = useMemo(() => searchSlug || hashSlug || envSlug || '', [searchSlug, hashSlug, envSlug])

  const effectiveSlug = useMemo(() => (resolvedSlug || investorId || '').trim().toLowerCase(), [resolvedSlug, investorId])

  const buildDownloadUrl = useCallback((category, slug, filename) => {
    const params = new URLSearchParams()
    params.set('category', category)
    params.set('slug', slug)
    params.set('filename', filename)
    return `/.netlify/functions/get-doc?${params.toString()}`
  }, [])

  const fetchDocs = useCallback(async (category) => {
    const res = await api.listDocs({ category, slug: effectiveSlug })
    const files = Array.isArray(res?.files) ? res.files : []
    return files
  }, [effectiveSlug])

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
    if (!uploadInfo) return null
    setError(null)
    try{
      const payload = {
        category: uploadInfo.category,
        slug: uploadInfo.slug,
        filename: uploadInfo.filename,
        contentBase64: uploadInfo.base64
      }
      const response = await api.uploadDoc(payload)
      await refreshCategory(uploadInfo.category)
      const successMsg = options.strategy === 'rename'
        ? 'Documento subido con sufijo automático.'
        : 'Documento subido.'
      showToast(successMsg, { tone: 'success' })
      uploadInfo.form?.reset?.()
      setSelectedFiles((prev) => ({ ...prev, [uploadInfo.category]: null }))
      setPendingUpload(null)
      setRenamePrompt(null)
      return response
    }catch(err){
      if (err?.status === 409 && err?.data?.error === 'FILE_EXISTS' && options.strategy !== 'rename'){
        const fallbackPath = `${uploadInfo.category}/${uploadInfo.slug}/${uploadInfo.filename}`
        setPendingUpload(uploadInfo)
        setRenamePrompt({ path: err.data?.path || fallbackPath, category: uploadInfo.category })
        return null
      }
      const message = err?.message || 'No se pudo subir el archivo'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
      return null
    }
  }, [refreshCategory, showToast])

  const handleUpload = useCallback((category) => async (e) => {
    e.preventDefault()
    setError(null)
    setPendingUpload(null)
    setRenamePrompt(null)
    const form = e.target
    const selectedFile = selectedFiles[category] || (form.file && form.file.files ? form.file.files[0] : null)

    if (!selectedFile){
      const message = 'Selecciona un archivo antes de subir.'
      setError(message)
      showToast(message, { tone: 'warning', duration: 4000 })
      return
    }

    const slug = resolvedSlug
    if (!slug){
      const message = 'No se detectó el inversionista (slug). Abre el panel con ?investor=<slug> o configura VITE_PUBLIC_INVESTOR_ID.'
      setError(message)
      showToast(message, { tone: 'error', duration: 6000 })
      return
    }

    setUploadingCategory(category)
    try{
      const base64 = await toBase64(selectedFile)
      if (!base64){
        throw new Error('El archivo está vacío o no se pudo convertir.')
      }
      await performUpload({
        category,
        filename: selectedFile.name,
        base64,
        slug,
        form
      })
    }catch(err){
      const message = err?.message || 'No se pudo leer el archivo'
      setError(message)
      showToast(message, { tone: 'error', duration: 5000 })
    }finally{
      setUploadingCategory(null)
    }
  }, [selectedFiles, resolvedSlug, performUpload, showToast])

  const handleConfirmRename = useCallback(async () => {
    if (!pendingUpload){
      setRenamePrompt(null)
      return
    }
    setUploadingCategory(pendingUpload.category)
    try{
      await performUpload(pendingUpload, { strategy: 'rename' })
    }finally{
      setUploadingCategory(null)
    }
  }, [pendingUpload, performUpload])

  const handleCancelRename = useCallback(() => {
    setPendingUpload(null)
    setRenamePrompt(null)
  }, [])

  const handleFileChange = useCallback((category) => (event) => {
    const file = event.target && event.target.files ? event.target.files[0] : null
    setSelectedFiles((prev) => ({ ...prev, [category]: file || null }))
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
                  <input
                    name="file"
                    type="file"
                    className="input"
                    disabled={isUploading}
                    onChange={handleFileChange(category)}
                  />
                  <button
                    className="btn"
                    type="submit"
                    disabled={isUploading || !selectedFiles[category]}
                  >
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
                      const parts = (d.path || '').split('/').filter(Boolean)
                      const slugFromPath = parts.length >= 2 ? parts[1] : ''
                      const docSlug = slugFromPath || effectiveSlug
                      const downloadUrl = docSlug
                        ? buildDownloadUrl(category, docSlug, d.name)
                        : '#'
                      return (
                        <tr key={d.path}>
                          <td>{d.name}</td>
                          <td>{(d.size / 1024).toFixed(1)} KB</td>
                          <td>
                            <a className="btn secondary" href={downloadUrl}>Descargar</a>
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
