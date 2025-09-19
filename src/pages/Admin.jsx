import React, { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import RoleGate from '../components/RoleGate'
import { DEFAULT_INVESTOR_ID } from '../lib/config'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

const PORTFOLIO_OPTIONS = [
  { value: 'solarFarms', label: 'Granjas Solares' },
  { value: 'aaaCompanies', label: 'Empresas AAA' },
  { value: 'ownSites', label: 'Sitios Propios' },
  { value: 'mix', label: 'Mix' }
]

const MIX_FIELDS = [
  { key: 'solarFarms', label: 'Granjas Solares' },
  { key: 'aaaCompanies', label: 'Empresas AAA' },
  { key: 'ownSites', label: 'Sitios Propios' }
]

const PROJECT_NUMBER_FIELDS = [
  { key: 'power_kwp', label: 'Potencia (kWp)' },
  { key: 'energy_mwh', label: 'Energía anual (MWh)' },
  { key: 'co2_tons', label: 'CO₂ evitado (t/año)' }
]

const DOC_CATEGORIES = [
  'NDA',
  'Propuestas',
  'Modelos financieros',
  'Contratos',
  'LOIs',
  'Sustento fiscal',
  'Mitigación de riesgos',
  'Procesos'
]

const createEmptyProject = () => ({
  id: '',
  name: '',
  client: '',
  location: '',
  power_kwp: '',
  energy_mwh: '',
  co2_tons: '',
  model: '',
  status: 'Disponible',
  notes: '',
  loi_template: ''
})

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

const deadlinesToRows = (deadlines) => {
  if (!deadlines || typeof deadlines !== 'object') return [{ key: '', value: '' }]
  const entries = Object.entries(deadlines)
  if (!entries.length) return [{ key: '', value: '' }]
  return entries.map(([key, value]) => ({ key, value: value || '' }))
}

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 1000
}

const modalCardStyle = {
  width: '100%',
  maxWidth: 420,
  background: '#fff',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)'
}

const modalButtonRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 16
}

export default function Admin({ user }){
  const defaultName = DEFAULT_INVESTOR_ID === 'femsa'
    ? 'FEMSA'
    : DEFAULT_INVESTOR_ID.toUpperCase()
  const initialDeadlines = { 'LOI':'2025-10-15', 'Firma':'2025-11-30' }
  const [payload, setPayload] = useState({
    id: DEFAULT_INVESTOR_ID,
    name: defaultName,
    status: 'LOI',
    deadlines: initialDeadlines,
    metrics: {
      decisionTime: 35,
      fiscalCapitalInvestment: 20000000,
      projectProfitability: { amount: 12500000, years: 7 },
      portfolio: {
        type: 'mix',
        mix: { solarFarms: 40, aaaCompanies: 35, ownSites: 25 }
      },
      investorsActive: 12,
      dealsAccelerated: 38,
      nps: 72
    }
  })
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)
  const [deadlineRows, setDeadlineRows] = useState(() => deadlinesToRows(initialDeadlines))
  const [investorLoading, setInvestorLoading] = useState(false)

  const [inv, setInv] = useState({ email: '', companyName: '', slug: '', status: 'NDA', deadlines: [{ k: '', v: '' }, { k: '', v: '' }] })
  const [invMsg, setInvMsg] = useState(null)
  const [invErr, setInvErr] = useState(null)
  const [invLoading, setInvLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const [investorList, setInvestorList] = useState([])
  const [investorSearch, setInvestorSearch] = useState('')
  const [investorListLoading, setInvestorListLoading] = useState(false)
  const [investorListError, setInvestorListError] = useState(null)
  const [investorDeleteMsg, setInvestorDeleteMsg] = useState(null)
  const [investorDeleteErr, setInvestorDeleteErr] = useState(null)
  const [deletingInvestor, setDeletingInvestor] = useState(null)
  const [panelModal, setPanelModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [deleteModalError, setDeleteModalError] = useState(null)
  const [deleteModalLoading, setDeleteModalLoading] = useState(false)

  const [projectList, setProjectList] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectLoadErr, setProjectLoadErr] = useState(null)
  const [projectSaveMsg, setProjectSaveMsg] = useState(null)
  const [projectSaveErr, setProjectSaveErr] = useState(null)
  const [projectSaving, setProjectSaving] = useState(false)

  const [docSlugInput, setDocSlugInput] = useState(DEFAULT_INVESTOR_ID)
  const [docSlug, setDocSlug] = useState(DEFAULT_INVESTOR_ID)
  const [docCategory, setDocCategory] = useState(DOC_CATEGORIES[0])
  const [docList, setDocList] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState(null)
  const [docsNotice, setDocsNotice] = useState(null)
  const [docsWorking, setDocsWorking] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = window.sessionStorage.getItem('adminDocsRedirect')
    if (!raw) return
    window.sessionStorage.removeItem('adminDocsRedirect')
    try{
      const data = JSON.parse(raw)
      const category = DOC_CATEGORIES.includes(data?.category) ? data.category : DOC_CATEGORIES[0]
      const slug = normalizeSlug(data?.slug) || DEFAULT_INVESTOR_ID
      setDocCategory(category)
      setDocSlugInput(slug)
      setDocSlug(slug)
      window.setTimeout(() => {
        const input = document.getElementById('docs-slug')
        if (input && typeof input.scrollIntoView === 'function'){
          input.scrollIntoView({ behavior: 'smooth', block: 'center' })
          if (typeof input.focus === 'function') input.focus()
        }
      }, 80)
    }catch(error){
      console.error('No se pudo aplicar la redirección de documentos:', error)
    }
  }, [])

  const isAdmin = React.useMemo(() => {
    if (user && typeof user === 'object'){
      if (Array.isArray(user.roles)){
        if (user.roles.some(role => String(role).toLowerCase() === 'admin')) return true
      }
      if (typeof user.role === 'string' && user.role.toLowerCase() === 'admin') return true
      if (user.isAdmin === true) return true
    }
    if (import.meta?.env?.DEV && !user) return true
    return false
  }, [user])

  const siteBaseUrl = React.useMemo(() => {
    const envValue = typeof import.meta?.env?.VITE_SITE_URL === 'string'
      ? import.meta.env.VITE_SITE_URL.trim()
      : ''
    if (envValue) return envValue.replace(/\/$/, '')
    if (typeof window !== 'undefined' && window.location){
      const origin = window.location.origin || ''
      if (origin) return origin.replace(/\/$/, '')
    }
    return ''
  }, [])

  const loadInvestorList = useCallback(async () => {
    if (!isAdmin) return
    setInvestorListLoading(true)
    setInvestorListError(null)
    setInvestorDeleteMsg(null)
    setInvestorDeleteErr(null)
    try{
      const res = await api.listInvestors()
      const items = Array.isArray(res?.investors) ? res.investors : []
      setInvestorList(items)
    }catch(error){
      setInvestorList([])
      setInvestorListError(error.message)
    }finally{
      setInvestorListLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    loadInvestorList()
  }, [loadInvestorList])

  const filteredInvestors = React.useMemo(() => {
    const term = investorSearch.trim().toLowerCase()
    if (!term) return investorList
    return investorList.filter(item => {
      const haystack = [item.slug, item.name, item.email, item.status]
      return haystack.some(value => (value || '').toLowerCase().includes(term))
    })
  }, [investorList, investorSearch])
  const filteredInvestorCount = filteredInvestors.length

  const handleDeleteInvestor = useCallback(async (slug, options = {}) => {
    if (!isAdmin || !slug) return false
    if (!options.skipConfirm && typeof window !== 'undefined'){
      const confirmed = window.confirm(`¿Eliminar al inversionista "${slug}"? Esta acción no se puede deshacer.`)
      if (!confirmed) return false
    }
    setInvestorDeleteErr(null)
    setInvestorDeleteMsg(null)
    setDeletingInvestor(slug)
    try{
      await api.deleteInvestor(slug)
      setInvestorList(prev => prev.filter(item => item.slug !== slug))
      setInvestorDeleteMsg('Inversionista eliminado.')
      return true
    }catch(error){
      setInvestorDeleteErr(error.message)
      throw error
    }finally{
      setDeletingInvestor(null)
    }
  }, [isAdmin])

  const toFormProject = (project) => ({
    id: project.id || '',
    name: project.name || '',
    client: project.client || '',
    location: project.location || '',
    power_kwp: project.power_kwp ?? '',
    energy_mwh: project.energy_mwh ?? '',
    co2_tons: project.co2_tons ?? '',
    model: project.model || '',
    status: project.status || 'Disponible',
    notes: project.notes || '',
    loi_template: project.loi_template || ''
  })

  useEffect(() => {
    let active = true
    setProjectsLoading(true)
    setProjectLoadErr(null)
    api.listProjects()
      .then(items => {
        if (!active) return
        setProjectList(items.map(toFormProject))
      })
      .catch(error => {
        if (!active) return
        setProjectLoadErr(error.message)
      })
      .finally(() => {
        if (active) setProjectsLoading(false)
      })
    return () => { active = false }
  }, [])

  const loadDocs = useCallback(async () => {
    const slug = normalizeSlug(docSlug) || DEFAULT_INVESTOR_ID
    setDocsLoading(true)
    setDocsError(null)
    try{
      const res = await api.listDocs({ category: docCategory, slug })
      setDocList(res.files || [])
    }catch(error){
      setDocList([])
      setDocsError(error.message)
    }finally{
      setDocsLoading(false)
    }
  }, [docCategory, docSlug])

  useEffect(() => {
    loadDocs()
  }, [loadDocs])

  useEffect(() => {
    setDeadlineRows(deadlinesToRows(payload.deadlines))
  }, [payload.deadlines])

  const resetProjectFeedback = () => {
    setProjectSaveMsg(null)
    setProjectSaveErr(null)
  }

  const updateProjectField = (index, field, value) => {
    resetProjectFeedback()
    setProjectList(prev => prev.map((item, idx) => idx === index ? { ...item, [field]: value } : item))
  }

  const addProject = () => {
    resetProjectFeedback()
    setProjectList(prev => [...prev, createEmptyProject()])
  }

  const removeProject = (index) => {
    resetProjectFeedback()
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar este proyecto?')) return
    setProjectList(prev => prev.filter((_, idx) => idx !== index))
  }

  const toNumberOrThrow = (value, label, id) => {
    const raw = (value === null || value === undefined) ? '' : String(value).trim()
    if (!raw){
      throw new Error(`Proyecto ${id} requiere ${label}`)
    }
    const num = Number(raw)
    if (!Number.isFinite(num)){
      throw new Error(`Proyecto ${id} tiene ${label} inválido`)
    }
    return num
  }

  const sanitizeProjects = () => {
    const seen = new Set()
    const sanitized = projectList.map((project, index) => {
      const id = (project.id || '').trim()
      if (!id) throw new Error(`El proyecto ${index + 1} requiere un ID`)
      const name = (project.name || '').trim()
      if (!name) throw new Error(`Proyecto ${id} requiere nombre`)
      const client = (project.client || '').trim()
      if (!client) throw new Error(`Proyecto ${id} requiere cliente`)
      const location = (project.location || '').trim()
      if (!location) throw new Error(`Proyecto ${id} requiere ubicación`)
      const model = (project.model || '').trim()
      if (!model) throw new Error(`Proyecto ${id} requiere modelo`)
      const status = (project.status || '').trim() || 'Disponible'

      const base = {
        id,
        name,
        client,
        location,
        power_kwp: toNumberOrThrow(project.power_kwp, 'potencia (kWp)', id),
        energy_mwh: toNumberOrThrow(project.energy_mwh, 'energía anual (MWh)', id),
        co2_tons: toNumberOrThrow(project.co2_tons, 'CO₂ evitado (t/año)', id),
        model,
        status
      }

      const notes = (project.notes || '').trim()
      if (notes) base.notes = notes
      const loiTemplate = (project.loi_template || '').trim()
      if (loiTemplate) base.loi_template = loiTemplate

      return base
    })

    for (const project of sanitized){
      if (seen.has(project.id)){
        throw new Error(`ID duplicado: ${project.id}`)
      }
      seen.add(project.id)
    }

    return sanitized
  }

  const onSaveProjects = async (e) => {
    e.preventDefault()
    resetProjectFeedback()
    setProjectSaving(true)
    try{
      const sanitized = sanitizeProjects()
      await api.saveProjects(sanitized)
      setProjectList(sanitized.map(toFormProject))
      setProjectSaveMsg('Proyectos guardados y commiteados a GitHub.')
    }catch(error){
      setProjectSaveErr(error.message)
    }finally{
      setProjectSaving(false)
    }
  }

  const handleDocSlugSubmit = (e) => {
    e.preventDefault()
    setDocsNotice(null)
    setDocsError(null)
    const normalized = normalizeSlug(docSlugInput)
    const finalSlug = normalized || DEFAULT_INVESTOR_ID
    setDocSlugInput(finalSlug)
    if (finalSlug === docSlug){
      loadDocs()
    }else{
      setDocSlug(finalSlug)
    }
  }

  const handleDocUpload = (e) => {
    e.preventDefault()
    setDocsError(null)
    setDocsNotice(null)
    const form = e.target
    const file = form.file.files[0]
    if (!file) return
    const slug = normalizeSlug(docSlug) || DEFAULT_INVESTOR_ID
    const reader = new FileReader()
    reader.onload = async () => {
      try{
        const result = typeof reader.result === 'string' ? reader.result : ''
        const base64 = result.includes(',') ? result.split(',')[1] : ''
        if (!base64) throw new Error('No se pudo leer el archivo')
        await api.uploadDoc({
          path: `${docCategory}`,
          filename: file.name,
          message: `Upload ${file.name} desde Admin`,
          contentBase64: base64,
          slug
        })
        setDocsNotice('Archivo subido.')
        form.reset()
        await loadDocs()
      }catch(error){
        setDocsError(error.message)
      }finally{
        setDocsWorking(false)
      }
    }
    reader.onerror = () => {
      setDocsWorking(false)
      setDocsError('No se pudo leer el archivo')
    }
    setDocsWorking(true)
    reader.readAsDataURL(file)
  }

  const handleDocDelete = async (file) => {
    if (!file || !file.path) return
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar ${file.name}?`)) return
    setDocsError(null)
    setDocsNotice(null)
    try{
      setDocsWorking(true)
      await api.deleteDoc({
        path: file.path,
        message: `Delete ${file.name} desde Admin`
      })
      setDocsNotice('Documento eliminado.')
      await loadDocs()
    }catch(error){
      setDocsError(error.message)
    }finally{
      setDocsWorking(false)
    }
  }

  const metrics = payload.metrics || {}
  const normalizedPayloadSlug = normalizeSlug(payload.id)
  const canLoadInvestor = Boolean(normalizedPayloadSlug)
  const effectiveDocSlug = normalizeSlug(docSlug) || DEFAULT_INVESTOR_ID

  const handleDeadlineRowChange = (index, field, value) => {
    setDeadlineRows(prev => prev.map((row, idx) => (
      idx === index ? { ...row, [field]: value } : row
    )))
  }

  const addDeadlineRow = () => {
    setDeadlineRows(prev => [...prev, { key: '', value: '' }])
  }

  const removeDeadlineRow = (index) => {
    setDeadlineRows(prev => {
      if (prev.length <= 1) return [{ key: '', value: '' }]
      return prev.filter((_, idx) => idx !== index)
    })
  }

  const handleLoadInvestor = async () => {
    const slug = normalizeSlug(payload.id)
    if (!slug){
      setErr('El slug (id) es requerido para cargar datos')
      return
    }
    setMsg(null)
    setErr(null)
    setInvestorLoading(true)
    try {
      const data = await api.getInvestor(slug)
      setPayload(prev => ({
        ...prev,
        ...data,
        id: slug,
        metrics: data.metrics || {},
        deadlines: data.deadlines || {}
      }))
    } catch (error) {
      setErr(`No se pudo cargar inversionista: ${error.message}`)
    } finally {
      setInvestorLoading(false)
    }
  }

  const handleOpenPanelModal = () => {
    const slug = normalizeSlug(payload.id)
    if (!slug){
      setErr('El slug (id) es requerido para ver el panel público')
      return
    }
    const base = siteBaseUrl ? siteBaseUrl.replace(/\/$/, '') : ''
    const url = `${base}/#/?investor=${slug}`
    setPanelModal({ slug, url })
  }

  const handleClosePanelModal = () => {
    setPanelModal(null)
  }

  const handleOpenDeleteModal = () => {
    const slug = normalizeSlug(payload.id)
    if (!slug){
      setErr('El slug (id) es requerido para eliminar al inversionista')
      return
    }
    setDeleteModal({ slug })
    setDeleteModalError(null)
  }

  const handleCloseDeleteModal = () => {
    if (deleteModalLoading) return
    setDeleteModal(null)
    setDeleteModalError(null)
  }

  const confirmDeleteFromModal = async () => {
    if (!deleteModal?.slug) return
    setDeleteModalError(null)
    setDeleteModalLoading(true)
    try{
      await handleDeleteInvestor(deleteModal.slug, { skipConfirm: true })
      setDeleteModal(null)
    }catch(error){
      setDeleteModalError(error.message)
    }finally{
      setDeleteModalLoading(false)
    }
  }

  const updateMetric = (key, updater) => {
    setPayload(prev => {
      const prevMetrics = prev.metrics || {}
      const nextValue = typeof updater === 'function'
        ? updater(prevMetrics[key])
        : updater
      return { ...prev, metrics: { ...prevMetrics, [key]: nextValue } }
    })
  }

  const handlePortfolioTypeChange = (type) => {
    updateMetric('portfolio', current => {
      const next = { type }
      if (type === 'mix'){
        const prevMix = current && current.type === 'mix' && current.mix ? current.mix : {}
        next.mix = {
          solarFarms: prevMix.solarFarms ?? '',
          aaaCompanies: prevMix.aaaCompanies ?? '',
          ownSites: prevMix.ownSites ?? ''
        }
      }
      return next
    })
  }

  const handleMixChange = (field, value) => {
    updateMetric('portfolio', current => {
      const base = current && current.type === 'mix'
        ? current
        : { type: 'mix', mix: { solarFarms: '', aaaCompanies: '', ownSites: '' } }
      return {
        ...base,
        mix: {
          ...(base.mix || {}),
          [field]: value
        }
      }
    })
  }

  const portfolio = metrics.portfolio || {}
  const isPortfolioMix = portfolio.type === 'mix'
  const mixValues = isPortfolioMix
    ? {
        solarFarms: portfolio.mix?.solarFarms ?? '',
        aaaCompanies: portfolio.mix?.aaaCompanies ?? '',
        ownSites: portfolio.mix?.ownSites ?? ''
      }
    : { solarFarms: '', aaaCompanies: '', ownSites: '' }
  const mixTotal = isPortfolioMix
    ? MIX_FIELDS.reduce((sum, field) => {
        const raw = mixValues[field.key]
        const num = Number(raw)
        return sum + (Number.isNaN(num) ? 0 : num)
      }, 0)
    : 0
  const projectProfitability = metrics.projectProfitability || {}

  const labelStyle = { fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }
  const fieldStyle = { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 200 }
  const mixFieldStyle = { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 160 }
  const projectBoxStyle = { border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginTop: 12, background: '#f7f7fb' }
  const noteAreaStyle = { minHeight: 96, resize: 'vertical' }

  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    try{
      const normalizedId = normalizeSlug(payload.id)
      if (!normalizedId){
        throw new Error('El slug (id) es requerido')
      }

      const metricsPayload = payload.metrics || {}
      const normalizedMetrics = {
        ...metricsPayload,
        decisionTime: parseNumber(metricsPayload.decisionTime),
        fiscalCapitalInvestment: parseNumber(metricsPayload.fiscalCapitalInvestment)
      }

      if (metricsPayload.investorsActive !== undefined){
        normalizedMetrics.investorsActive = parseNumber(metricsPayload.investorsActive)
      }
      if (metricsPayload.dealsAccelerated !== undefined){
        normalizedMetrics.dealsAccelerated = parseNumber(metricsPayload.dealsAccelerated)
      }
      if (metricsPayload.nps !== undefined){
        normalizedMetrics.nps = parseNumber(metricsPayload.nps)
      }

      const profitRaw = metricsPayload.projectProfitability || {}
      const profitAmount = parseNumber(profitRaw.amount)
      const profitYears = parseNumber(profitRaw.years)
      normalizedMetrics.projectProfitability = (profitAmount === null && profitYears === null)
        ? null
        : { amount: profitAmount, years: profitYears }

      const portfolioRaw = metricsPayload.portfolio
      if (!portfolioRaw || !portfolioRaw.type){
        normalizedMetrics.portfolio = null
      }else if (portfolioRaw.type === 'mix'){
        const mixRaw = portfolioRaw.mix || {}
        const normalizedMix = MIX_FIELDS.reduce((acc, field) => {
          const parsed = parseNumber(mixRaw[field.key])
          if (parsed !== null){
            acc[field.key] = parsed
          }
          return acc
        }, {})
        normalizedMetrics.portfolio = { type: 'mix', mix: normalizedMix }
      }else{
        normalizedMetrics.portfolio = { type: portfolioRaw.type }
      }

      const normalizedName = typeof payload.name === 'string'
        ? payload.name.trim()
        : ''
      const normalizedDeadlines = deadlineRows.reduce((acc, item) => {
        const key = (item.key || '').trim()
        const value = item.value || ''
        if (key && value){
          acc[key] = value
        }
        return acc
      }, {})

      const payloadToSend = {
        ...payload,
        id: normalizedId,
        name: normalizedName,
        metrics: normalizedMetrics,
        deadlines: normalizedDeadlines
      }

      await api.updateStatus(payloadToSend)
      setPayload(payloadToSend)
      setMsg('Guardado y commiteado a GitHub.')
    }catch(error){ setErr(error.message) }
  }

  const setDeadline = (i, field, value) => {
    const arr = [...inv.deadlines]
    arr[i] = { ...arr[i], [field]: value }
    setInv({ ...inv, deadlines: arr })
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setInvMsg(null); setInvErr(null)
    setInvLoading(true); setProgress(10)
    try{
      const dl = {}
      for (const d of inv.deadlines){ if (d.k && d.v) dl[d.k] = d.v }
      const payload = { email: inv.email, companyName: inv.companyName, status: inv.status, deadlines: dl }
      if (inv.slug) payload.slug = inv.slug
      const res = await api.createInvestor(payload)
      setProgress(100)
      setInvMsg(res.link)
      try{ await navigator.clipboard.writeText(res.link) }catch{}
    }catch(error){ setInvErr(`Error al crear inversionista: ${error.message}`); setProgress(0) }
    finally{ setInvLoading(false) }
  }

  return (
    <RoleGate user={user} allow={['admin','ri']}>
      <div className="container">
        <div className="h1">Admin / Relaciones con Inversionistas</div>
        <div className="card" style={{marginBottom:12}}>
          <div className="h2">Alta de Inversionista</div>
          <form onSubmit={onCreate}>
            <div className="form-row">
              <input className="input" type="email" placeholder="Email corporativo" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} required />
              <input className="input" placeholder="Nombre de la empresa" value={inv.companyName} onChange={e => setInv({ ...inv, companyName: e.target.value })} required />
              <input className="input" placeholder="Slug deseado (opcional)" value={inv.slug} onChange={e => setInv({ ...inv, slug: e.target.value })} />
              <select className="select" value={inv.status} onChange={e => setInv({ ...inv, status: e.target.value })}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div style={{marginTop:8}}>
              {inv.deadlines.map((d, i) => (
                <div key={i} className="form-row" style={{marginTop:4}}>
                  <input className="input" placeholder="Nombre de la etapa de proceso" value={d.k} onChange={e => setDeadline(i, 'k', e.target.value)} />
                  <input className="input" type="date" value={d.v} onChange={e => setDeadline(i, 'v', e.target.value)} />
                </div>
              ))}
              <button type="button" className="btn" style={{marginTop:4}} onClick={() => setInv({ ...inv, deadlines: [...inv.deadlines, { k: '', v: '' }] })}>Agregar deadline</button>
            </div>
            <button className="btn" type="submit" disabled={invLoading} style={{marginTop:8}}>Crear</button>
          </form>
          {invLoading && <div className="progress" style={{marginTop:8}}><div style={{width: progress + '%'}} /></div>}
          {invMsg && (
            <div className="notice" style={{marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <span style={{wordBreak:'break-all'}}>{invMsg}</span>
              <button className="btn" type="button" onClick={() => navigator.clipboard && navigator.clipboard.writeText(invMsg)}>Copiar</button>
            </div>
          )}
          {invErr && <div className="notice" style={{marginTop:8}}>{invErr}</div>}
        </div>
        {isAdmin && (
          <div className="card" style={{marginBottom:12}}>
            <div className="h2">Inversionistas activos</div>
            <p style={{marginTop:0, marginBottom:12, color:'var(--muted)', fontSize:14}}>
              Consulta los inversionistas dados de alta y dales de baja cuando sea necesario.
            </p>
            <div className="form-row" style={{marginBottom:12}}>
              <input
                className="input"
                placeholder="Buscar por nombre, correo o slug"
                value={investorSearch}
                onChange={e => setInvestorSearch(e.target.value)}
              />
              <button
                type="button"
                className="btn secondary"
                onClick={loadInvestorList}
                disabled={investorListLoading}
              >
                {investorListLoading ? 'Actualizando...' : 'Actualizar lista'}
              </button>
            </div>
            {investorListError && <div className="notice" style={{marginBottom:12}}>{investorListError}</div>}
            {investorDeleteErr && <div className="notice" style={{marginBottom:12}}>{investorDeleteErr}</div>}
            {investorDeleteMsg && <div className="notice" style={{marginBottom:12}}>{investorDeleteMsg}</div>}
            <div style={{fontSize:13, color:'var(--muted)', marginBottom:8}}>
              {investorListLoading
                ? 'Cargando inversionistas...'
                : `${filteredInvestorCount} inversionista${filteredInvestorCount === 1 ? '' : 's'} coincidente${filteredInvestorCount === 1 ? '' : 's'}`}
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{minWidth:140}}>Empresa</th>
                    <th style={{minWidth:180}}>Correo</th>
                    <th style={{minWidth:100}}>Slug</th>
                    <th style={{minWidth:120}}>Estado</th>
                    <th style={{minWidth:120}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {investorListLoading && (
                    <tr>
                      <td colSpan={5} style={{paddingTop:12, paddingBottom:12}}>Cargando datos...</td>
                    </tr>
                  )}
                  {!investorListLoading && filteredInvestors.map(item => (
                    <tr key={item.slug}>
                      <td>{item.name || '—'}</td>
                      <td>{item.email || '—'}</td>
                      <td>{item.slug}</td>
                      <td>{item.status || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => handleDeleteInvestor(item.slug)}
                          disabled={deletingInvestor === item.slug}
                        >
                          {deletingInvestor === item.slug ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!investorListLoading && filteredInvestors.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{paddingTop:12, paddingBottom:12, color:'var(--muted)'}}>
                        No se encontraron inversionistas con los criterios actuales.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="card">
          <div className="h2">Actualizar estado de inversionista</div>
          <form onSubmit={onSubmit}>
            <div className="form-row">
              <input
                className="input"
                placeholder="slug (id)"
                value={payload.id}
                onChange={e => setPayload({ ...payload, id: e.target.value })}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleLoadInvestor}
                  disabled={investorLoading || !canLoadInvestor}
                >
                  {investorLoading ? 'Cargando...' : 'Cargar datos'}
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleOpenPanelModal}
                  disabled={!canLoadInvestor}
                >
                  Ver panel
                </button>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={handleOpenDeleteModal}
                  disabled={!canLoadInvestor || deletingInvestor === normalizedPayloadSlug}
                >
                  {deletingInvestor === normalizedPayloadSlug ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
              <input
                className="input"
                placeholder="Nombre"
                value={payload.name}
                onChange={e => setPayload({ ...payload, name: e.target.value })}
              />
              <select
                className="select"
                value={payload.status}
                onChange={e => setPayload({ ...payload, status: e.target.value })}
              >
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 12, fontWeight: 700 }}>Deadlines</div>
            <div style={{ marginTop: 8 }}>
              {deadlineRows.map((item, index) => (
                <div key={index} className="form-row" style={{ marginTop: 4, alignItems: 'flex-end' }}>
                  <div style={fieldStyle}>
                    <label htmlFor={`deadline-${index}-name`} style={labelStyle}>Etapa</label>
                    <input
                      id={`deadline-${index}-name`}
                      className="input"
                      placeholder="Nombre de la etapa"
                      value={item.key}
                      onChange={e => handleDeadlineRowChange(index, 'key', e.target.value)}
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label htmlFor={`deadline-${index}-date`} style={labelStyle}>Fecha</label>
                    <input
                      id={`deadline-${index}-date`}
                      className="input"
                      type="date"
                      value={item.value}
                      onChange={e => handleDeadlineRowChange(index, 'value', e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => removeDeadlineRow(index)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: 8 }}
                onClick={addDeadlineRow}
              >
                Agregar deadline
              </button>
            </div>

            <div style={{ marginTop: 12, fontWeight: 700 }}>Métricas clave</div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-decisionTime" style={labelStyle}>Días a decisión</label>
                <input
                  id="metric-decisionTime"
                  className="input"
                  type="number"
                  min="0"
                  value={metrics.decisionTime ?? ''}
                  onChange={e => updateMetric('decisionTime', e.target.value)}
                />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="metric-fiscal" style={labelStyle}>Inversión de capital fiscal ($)</label>
                <input
                  id="metric-fiscal"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={metrics.fiscalCapitalInvestment ?? ''}
                  onChange={e => updateMetric('fiscalCapitalInvestment', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-project-amount" style={labelStyle}>Utilidad de proyecto ($)</label>
                <input
                  id="metric-project-amount"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  value={projectProfitability.amount ?? ''}
                  onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), amount: e.target.value }))}
                />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="metric-project-years" style={labelStyle}>Horizonte (años)</label>
                <input
                  id="metric-project-years"
                  className="input"
                  type="number"
                  min="0"
                  value={projectProfitability.years ?? ''}
                  onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), years: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: 8 }}>
              <div style={fieldStyle}>
                <label htmlFor="metric-portfolio-type" style={labelStyle}>Portafolio</label>
                <select
                  id="metric-portfolio-type"
                  className="select"
                  value={portfolio.type || ''}
                  onChange={e => handlePortfolioTypeChange(e.target.value)}
                >
                  <option value="">Selecciona una opción</option>
                  {PORTFOLIO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {isPortfolioMix && (
              <div style={{ marginTop: 8 }}>
                <div className="form-row">
                  {MIX_FIELDS.map(field => (
                    <div key={field.key} style={mixFieldStyle}>
                      <label htmlFor={`metric-portfolio-${field.key}`} style={labelStyle}>{field.label} (%)</label>
                      <input
                        id={`metric-portfolio-${field.key}`}
                        className="input"
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        value={mixValues[field.key] ?? ''}
                        onChange={e => handleMixChange(field.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>Suma: {mixTotal}%</div>
              </div>
            )}

            <button className="btn" type="submit" style={{ marginTop: 12 }}>Guardar</button>
          </form>
          {msg && <div className="notice" style={{marginTop:8}}>{msg}</div>}
          {err && <div className="notice" style={{marginTop:8}}>{err}</div>}
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="h2">Documentos por inversionista</div>
          <form
            onSubmit={handleDocSlugSubmit}
            className="form-row"
            style={{ marginTop: 8, alignItems: 'flex-end', gap: 12 }}
          >
            <div style={{ ...fieldStyle, minWidth: 200 }}>
              <label htmlFor="docs-slug" style={labelStyle}>Slug del inversionista</label>
              <input
                id="docs-slug"
                className="input"
                value={docSlugInput}
                onChange={e => setDocSlugInput(e.target.value)}
                placeholder="slug"
              />
            </div>
            <div style={{ ...fieldStyle, minWidth: 200 }}>
              <label htmlFor="docs-category" style={labelStyle}>Categoría</label>
              <select
                id="docs-category"
                className="select"
                value={docCategory}
                onChange={e => { setDocCategory(e.target.value); setDocsNotice(null); setDocsError(null) }}
              >
                {DOC_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <button className="btn" type="submit" disabled={docsLoading || docsWorking}>Ver carpeta</button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => { setDocsNotice(null); setDocsError(null); loadDocs() }}
              disabled={docsLoading || docsWorking}
            >
              Actualizar
            </button>
          </form>
          <div style={{ marginTop: 8, fontSize: 13, color: 'var(--muted)' }}>
            Gestionando: <code>{docCategory}/{effectiveDocSlug}</code>
          </div>
          <form onSubmit={handleDocUpload} className="form-row" style={{ marginTop: 12 }}>
            <input name="file" type="file" className="input" disabled={docsWorking} />
            <button className="btn" type="submit" disabled={docsWorking}>Subir</button>
            <span className="notice">Los archivos se guardan en GitHub.</span>
          </form>
          {docsError && <div className="notice" style={{marginTop:8}}>{docsError}</div>}
          {docsNotice && <div className="notice" style={{marginTop:8}}>{docsNotice}</div>}
          {docsWorking && !docsLoading && <div style={{marginTop:8, color:'var(--muted)'}}>Procesando...</div>}
          {docsLoading && <div style={{marginTop:8, color:'var(--muted)'}}>Cargando documentos...</div>}
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docList.map(file => (
                <tr key={file.path}>
                  <td>{file.name}</td>
                  <td>{(file.size / 1024).toFixed(1)} KB</td>
                  <td style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <a
                      className="btn secondary"
                      href={api.downloadDocPath(file.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Descargar
                    </a>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => handleDocDelete(file)}
                      disabled={docsWorking}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {!docList.length && !docsLoading && (
                <tr>
                  <td colSpan="3">No hay documentos en esta carpeta.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="h2">Gestionar proyectos activos</div>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Actualiza la lista que aparece en la sección de Proyectos.</p>
          {projectLoadErr && <div className="notice" style={{marginTop:8}}>{projectLoadErr}</div>}
          {projectsLoading ? (
            <div style={{marginTop:8, color:'var(--muted)'}}>Cargando proyectos...</div>
          ) : (
            <form onSubmit={onSaveProjects}>
              {projectList.map((project, index) => (
                <div key={project.id || index} style={projectBoxStyle}>
                  <div className="row" style={{justifyContent:'space-between'}}>
                    <div style={{fontWeight:700}}>{project.name || project.id || `Proyecto ${index + 1}`}</div>
                    <button
                      type="button"
                      className="btn secondary"
                      style={{padding:'6px 12px', fontSize:12}}
                      onClick={() => removeProject(index)}
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="form-row" style={{marginTop:8}}>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-id`} style={labelStyle}>ID</label>
                      <input
                        id={`project-${index}-id`}
                        className="input"
                        value={project.id}
                        onChange={e => updateProjectField(index, 'id', e.target.value)}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-name`} style={labelStyle}>Nombre</label>
                      <input
                        id={`project-${index}-name`}
                        className="input"
                        value={project.name}
                        onChange={e => updateProjectField(index, 'name', e.target.value)}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-client`} style={labelStyle}>Cliente</label>
                      <input
                        id={`project-${index}-client`}
                        className="input"
                        value={project.client}
                        onChange={e => updateProjectField(index, 'client', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-row" style={{marginTop:8}}>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-location`} style={labelStyle}>Ubicación</label>
                      <input
                        id={`project-${index}-location`}
                        className="input"
                        value={project.location}
                        onChange={e => updateProjectField(index, 'location', e.target.value)}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-model`} style={labelStyle}>Modelo</label>
                      <input
                        id={`project-${index}-model`}
                        className="input"
                        value={project.model}
                        onChange={e => updateProjectField(index, 'model', e.target.value)}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-status`} style={labelStyle}>Estado</label>
                      <input
                        id={`project-${index}-status`}
                        className="input"
                        value={project.status}
                        onChange={e => updateProjectField(index, 'status', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-row" style={{marginTop:8}}>
                    {PROJECT_NUMBER_FIELDS.map(field => (
                      <div key={field.key} style={fieldStyle}>
                        <label htmlFor={`project-${index}-${field.key}`} style={labelStyle}>{field.label}</label>
                        <input
                          id={`project-${index}-${field.key}`}
                          className="input"
                          type="number"
                          min="0"
                          step="any"
                          value={project[field.key] ?? ''}
                          onChange={e => updateProjectField(index, field.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-row" style={{marginTop:8}}>
                    <div style={{ ...fieldStyle, minWidth: 260 }}>
                      <label htmlFor={`project-${index}-notes`} style={labelStyle}>Notas</label>
                      <textarea
                        id={`project-${index}-notes`}
                        className="input"
                        style={noteAreaStyle}
                        value={project.notes}
                        onChange={e => updateProjectField(index, 'notes', e.target.value)}
                      />
                    </div>
                    <div style={fieldStyle}>
                      <label htmlFor={`project-${index}-loi`} style={labelStyle}>Enlace a LOI</label>
                      <input
                        id={`project-${index}-loi`}
                        className="input"
                        type="url"
                        placeholder="https://"
                        value={project.loi_template}
                        onChange={e => updateProjectField(index, 'loi_template', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!projectList.length && (
                <div style={{marginTop:12, color:'var(--muted)'}}>No hay proyectos cargados. Usa "Agregar proyecto".</div>
              )}
              <div className="row" style={{marginTop:12, gap:8}}>
                <button type="button" className="btn secondary" onClick={addProject}>Agregar proyecto</button>
                <button type="submit" className="btn" disabled={projectSaving}>
                  {projectSaving ? 'Guardando...' : 'Guardar proyectos'}
                </button>
              </div>
            </form>
          )}
          {projectSaveMsg && <div className="notice" style={{marginTop:8}}>{projectSaveMsg}</div>}
          {projectSaveErr && <div className="notice" style={{marginTop:8}}>{projectSaveErr}</div>}
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="h2">Notas</div>
          <ul>
            <li>Este panel hace commits a GitHub (mismo repo) en <code>data/investors/&lt;slug&gt;.json</code>.</li>
            <li>Netlify vuelve a construir el sitio y los cambios quedan visibles al instante.</li>
          </ul>
        </div>
      </div>
      {panelModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Panel público del inversionista</div>
            <p style={{ marginTop: 8, marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
              Comparte este enlace con el inversionista <code>{panelModal.slug}</code>.
            </p>
            <input
              className="input"
              readOnly
              value={panelModal.url}
              style={{ marginTop: 4 }}
              onFocus={e => e.target.select()}
            />
            <div style={modalButtonRowStyle}>
              <button
                type="button"
                className="btn secondary"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard){
                    navigator.clipboard.writeText(panelModal.url).catch(() => {})
                  }
                }}
              >
                Copiar enlace
              </button>
              <a
                className="btn"
                href={panelModal.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir panel
              </a>
              <button type="button" className="btn secondary" onClick={handleClosePanelModal}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
      {deleteModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Eliminar inversionista</div>
            <p style={{ marginTop: 8, marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
              Se eliminará <code>data/investors/{deleteModal.slug}.json</code> y, si existe, la carpeta <code>data/docs/{deleteModal.slug}/</code>.
              Esta acción no se puede deshacer.
            </p>
            {deleteModalError && <div className="notice" style={{ marginTop: 8 }}>{deleteModalError}</div>}
            <div style={modalButtonRowStyle}>
              <button
                type="button"
                className="btn secondary"
                onClick={handleCloseDeleteModal}
                disabled={deleteModalLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={confirmDeleteFromModal}
                disabled={deleteModalLoading}
              >
                {deleteModalLoading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  )
}
