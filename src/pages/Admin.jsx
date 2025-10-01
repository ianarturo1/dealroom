import React, { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import RoleGate from '@/components/RoleGate'
import { DEFAULT_INVESTOR_ID } from '@/lib/config'
import { resolveDeadlineDocTarget } from '@/lib/deadlines'
import { DOCUMENT_SECTIONS_ORDER, DEFAULT_DOC_CATEGORY, DASHBOARD_DOC_CATEGORIES } from '@/constants/documents'
import { PIPELINE_STAGES, FINAL_PIPELINE_STAGE } from '@/constants/pipeline'
import { getDecisionBadge, getDecisionDays } from '@/utils/decision'
import { DeadlinesForm } from '@/components/deadlines/DeadlinesForm'
import { validateRows } from '@/lib/deadlineValidators'
import { STAGES } from '@/lib/stages'
import { useToast } from '@/lib/toast'
import { modalBackdropStyle, modalCardStyle, modalButtonRowStyle } from '@/components/modalStyles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Section } from '@/components/ui/Section'
import { FormRow } from '@/components/ui/FormRow'
import { Toolbar } from '@/components/ui/Toolbar'

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

const createEmptyProject = () => ({
  id: '',
  name: '',
  client: '',
  location: '',
  power_kwp: '',
  energy_mwh: '',
  co2_tons: '',
  status: 'Disponible',
  termMonths: '',
  empresa: '',
  imageUrl: '',
  notes: '',
  loi_template: ''
})

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

const withoutDecisionTime = (metrics) => {
  if (!metrics || typeof metrics !== 'object') return {}
  const { decisionTime, ...rest } = metrics
  return { ...rest }
}

const ensureDeadlineRows = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return [{ stage: '', date: '' }]
  return rows.map(item => ({
    stage: item?.stage ?? '',
    date: item?.date ?? '',
  }))
}

const deadlinesToRows = (deadlines) => {
  if (!deadlines || typeof deadlines !== 'object') return ensureDeadlineRows([])
  const entries = Object.entries(deadlines)
    .filter(([stage]) => typeof stage === 'string' && stage.trim())
    .map(([stage, date]) => ({
      stage,
      date: typeof date === 'string' ? date : String(date || ''),
    }))
  entries.sort((a, b) => {
    const ai = STAGES.indexOf(a.stage)
    const bi = STAGES.indexOf(b.stage)
    if (ai === -1 && bi === -1) return a.stage.localeCompare(b.stage)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return ensureDeadlineRows(entries)
}

export default function Admin({ user }){
  const showToast = useToast()
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
  const [deadlineFormKey, setDeadlineFormKey] = useState(0)
  const [deadlinesMsg, setDeadlinesMsg] = useState(null)
  const [deadlinesErr, setDeadlinesErr] = useState(null)
  const [deadlinesSaving, setDeadlinesSaving] = useState(false)
  const [investorLoading, setInvestorLoading] = useState(false)

  const [invDeadlinesKey, setInvDeadlinesKey] = useState(0)
  const [inv, setInv] = useState({ email: '', companyName: '', slug: '', status: 'NDA', deadlines: ensureDeadlineRows([]) })
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
  const [docCategory, setDocCategory] = useState(DEFAULT_DOC_CATEGORY)
  const [docList, setDocList] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docsError, setDocsError] = useState(null)
  const [docsNotice, setDocsNotice] = useState(null)
  const [docsWorking, setDocsWorking] = useState(false)
  const [pendingDocUpload, setPendingDocUpload] = useState(null)
  const [docRenamePrompt, setDocRenamePrompt] = useState(null)

// --- REDIRECCIÓN DESDE "Ver carpeta/Subir docs" (mantener) ---
useEffect(() => {
  if (typeof window === 'undefined') return;
  const raw = window.sessionStorage.getItem('adminDocsRedirect');
  if (!raw) return;
  window.sessionStorage.removeItem('adminDocsRedirect');
  try {
    const data = JSON.parse(raw);
    const category = DOCUMENT_SECTIONS_ORDER.includes(data?.category) ? data.category : DEFAULT_DOC_CATEGORY;
    const slug = normalizeSlug(data?.slug) || DEFAULT_INVESTOR_ID;

    setDocCategory(category);
    setDocSlugInput(slug);
    setDocSlug(slug);

    window.setTimeout(() => {
      const input = document.getElementById('docs-slug');
      if (input && typeof input.scrollIntoView === 'function') {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (input && typeof input.focus === 'function') input.focus();
    }, 80);
  } catch (error) {
    console.error('No se pudo aplicar la redirección de documentos:', error);
  }
}, []);

// --- REFS Y ESTADOS (mantener de main) ---
const docsCardRef = React.useRef(null);
const docsUploadInputRef = React.useRef(null);
const docsTableRef = React.useRef(null);

const [investorDetailsMap, setInvestorDetailsMap] = useState({});
const [investorDetailsLoading, setInvestorDetailsLoading] = useState(false);
const [investorDetailsError, setInvestorDetailsError] = useState(null);
const [deadlineThreshold, setDeadlineThreshold] = useState(14);

const [docInventories, setDocInventories] = useState({});
const [docInventoriesReady, setDocInventoriesReady] = useState(false);
const [docHealthLoading, setDocHealthLoading] = useState(false);
const [docHealthError, setDocHealthError] = useState(null);
const [docRefreshKey, setDocRefreshKey] = useState(0);

const [activityItems, setActivityItems] = useState([]);
const [activityLoading, setActivityLoading] = useState(false);
const [activityError, setActivityError] = useState(null);
const [activityRefreshKey, setActivityRefreshKey] = useState(0);


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

  const finalStageLabel = FINAL_PIPELINE_STAGE
  const numberFormatter = React.useMemo(() => new Intl.NumberFormat('es-MX'), [])
  const percentFormatter = React.useMemo(
    () => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }),
    []
  )
  const shortDateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }),
    []
  )
  const dateTimeFormatter = React.useMemo(
    () => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
    []
  )

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

  const normalizeTermMonths = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.round(value))
    }
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    const parsed = parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return ''
    return Math.max(0, parsed)
  }

  const toFormProject = (project) => ({
    id: project.id || '',
    name: project.name || '',
    client: project.client || '',
    location: project.location || '',
    power_kwp: project.power_kwp ?? '',
    energy_mwh: project.energy_mwh ?? '',
    co2_tons: project.co2_tons ?? '',
    status: project.status || 'Disponible',
    termMonths: normalizeTermMonths(project.termMonths),
    empresa: typeof project.empresa === 'string' ? project.empresa : '',
    imageUrl: typeof project.imageUrl === 'string' ? project.imageUrl : '',
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
    if (!isAdmin){
      setInvestorDetailsMap({})
      setInvestorDetailsError(null)
      setInvestorDetailsLoading(false)
      return
    }
    if (!investorList.length){
      setInvestorDetailsMap({})
      setInvestorDetailsError(null)
      setInvestorDetailsLoading(false)
      return
    }
    let active = true
    setInvestorDetailsLoading(true)
    setInvestorDetailsError(null)
    ;(async () => {
      try{
        const entries = await Promise.all(investorList.map(async (item) => {
          try{
            const data = await api.getInvestor(item.slug)
            return [item.slug, data]
          }catch(error){
            return [item.slug, { __error: error.message }]
          }
        }))
        if (!active) return
        const nextMap = {}
        const errors = []
        for (const [slug, data] of entries){
          if (data && !data.__error){
            nextMap[slug] = data
          }else if (data && data.__error){
            errors.push(`${slug}: ${data.__error}`)
          }
        }
        setInvestorDetailsMap(nextMap)
        if (errors.length){
          setInvestorDetailsError(`Datos incompletos para ${errors.length} inversionista${errors.length === 1 ? '' : 's'}.`)
        }
      }catch(error){
        if (!active) return
        setInvestorDetailsMap({})
        setInvestorDetailsError(error.message)
      }finally{
        if (active) setInvestorDetailsLoading(false)
      }
    })()
    return () => { active = false }
  }, [isAdmin, investorList])

  useEffect(() => {
    if (!isAdmin){
      setDocInventories({})
      setDocInventoriesReady(false)
      setDocHealthError(null)
      setDocHealthLoading(false)
      return
    }
    if (!investorList.length){
      setDocInventories({})
      setDocInventoriesReady(false)
      setDocHealthError(null)
      setDocHealthLoading(false)
      return
    }
    let active = true
    setDocHealthLoading(true)
    setDocHealthError(null)
    ;(async () => {
      const next = {}
      try{
        for (const category of DASHBOARD_DOC_CATEGORIES){
          if (!active) return
          const categoryData = {}
          for (const investor of investorList){
            if (!active) return
            try{
              const res = await api.listDocs({ category, slug: investor.slug })
              const files = Array.isArray(res?.files) ? res.files : []
              categoryData[investor.slug] = { files, error: null }
            }catch(error){
              const message = error.message || 'Error desconocido'
              categoryData[investor.slug] = { files: [], error: message }
              const lower = message.toLowerCase()
              if (lower.includes('github_token') || lower.includes('no configurado') || lower.includes('500 ')){
                throw error
              }
            }
          }
          next[category] = categoryData
        }
        if (!active) return
        setDocInventories(next)
        setDocInventoriesReady(true)
      }catch(error){
        if (!active) return
        setDocInventories({})
        setDocInventoriesReady(false)
        setDocHealthError(error.message)
      }finally{
        if (active) setDocHealthLoading(false)
      }
    })()
    return () => { active = false }
  }, [isAdmin, investorList, docRefreshKey])

  useEffect(() => {
    if (!isAdmin){
      setActivityItems([])
      setActivityError(null)
      setActivityLoading(false)
      return
    }
    let active = true
    setActivityLoading(true)
    setActivityError(null)
    api.listActivity()
      .then(res => {
        if (!active) return
        const events = Array.isArray(res?.events) ? res.events.slice() : []
        events.sort((a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime())
        setActivityItems(events)
      })
      .catch(error => {
        if (!active) return
        setActivityError(error.message)
        setActivityItems([])
      })
      .finally(() => {
        if (active) setActivityLoading(false)
      })
    return () => { active = false }
  }, [isAdmin, activityRefreshKey])

  useEffect(() => {
    setDeadlineRows(deadlinesToRows(payload.deadlines))
    setDeadlineFormKey(value => value + 1)
  }, [payload.deadlines])

  const resetProjectFeedback = () => {
    setProjectSaveMsg(null)
    setProjectSaveErr(null)
  }

  const updateProjectField = (index, field, rawValue) => {
    resetProjectFeedback()
    let value = rawValue
    if (field === 'empresa') {
      value = String(rawValue || '').trim()
    } else if (field === 'imageUrl') {
      value = String(rawValue || '').trim()
    }
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
      return null
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
      const location = (project.location || '').trim()
      const status = (project.status || '').trim() || 'Disponible'
      const termMonthsRaw = (project.termMonths === null || project.termMonths === undefined)
        ? ''
        : String(project.termMonths).trim()
      const empresa = typeof project.empresa === 'string' ? project.empresa.trim() : ''
      const imageUrl = typeof project.imageUrl === 'string' ? project.imageUrl.trim() : ''
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        throw new Error(`Proyecto ${id} tiene Imagen (URL) inválida`)
      }

      const base = {
        id,
        name,
        status
      }

      if (client) base.client = client
      if (location) base.location = location

      for (const field of PROJECT_NUMBER_FIELDS){
        const value = toNumberOrThrow(project[field.key], field.label, id)
        if (value !== null) {
          base[field.key] = value
        }
      }

      if (termMonthsRaw) {
        const parsedTerm = parseInt(termMonthsRaw, 10)
        if (!Number.isFinite(parsedTerm)) {
          throw new Error(`Proyecto ${id} tiene Plazo (meses) inválido`)
        }
        base.termMonths = Math.max(0, parsedTerm)
      }

      if (empresa) base.empresa = empresa
      if (imageUrl) base.imageUrl = imageUrl

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

  const performDocUpload = useCallback(async (uploadInfo, options = {}) => {
    if (!uploadInfo) return null
    setDocsError(null)
    setDocsNotice(null)
    setDocsWorking(true)
    try{
      const payload = {
        path: `${uploadInfo.category}`,
        filename: uploadInfo.filename,
        contentBase64: uploadInfo.base64,
        slug: uploadInfo.slug,
        message: uploadInfo.message
      }
      if (options.strategy === 'rename'){
        payload.strategy = 'rename'
      }
      const response = await api.uploadDoc(payload)
      const successMsg = options.strategy === 'rename'
        ? 'Archivo subido con sufijo automático.'
        : 'Archivo subido.'
      setDocsNotice(successMsg)
      showToast(successMsg, { tone: 'success' })
      uploadInfo.form?.reset()
      setPendingDocUpload(null)
      setDocRenamePrompt(null)
      await loadDocs()
      return response
    }catch(error){
      if (error?.status === 409 && error?.data?.error === 'FILE_EXISTS' && options.strategy !== 'rename'){
        const fallbackPath = `${uploadInfo.category}/${uploadInfo.slug}/${uploadInfo.filename}`
        setPendingDocUpload(uploadInfo)
        setDocRenamePrompt({
          path: error.data?.path || fallbackPath,
          category: uploadInfo.category,
          slug: uploadInfo.slug
        })
        return null
      }
      const message = error?.message || 'No se pudo subir el archivo'
      setDocsError(message)
      showToast(message, { tone: 'error', duration: 5000 })
      return null
    }finally{
      setDocsWorking(false)
    }
  }, [loadDocs, showToast])

  const handleDocUpload = (e) => {
    e.preventDefault()
    if (docsWorking) return
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
        const base64 = result.includes(',') ? result.split(',')[1] : result
        if (!base64) throw new Error('No se pudo leer el archivo')
        await performDocUpload({
          category: docCategory,
          filename: file.name,
          base64,
          slug,
          message: `Upload ${file.name} desde Admin`,
          form
        })
      }catch(error){
        const message = error?.message || 'No se pudo leer el archivo'
        setDocsError(message)
        showToast(message, { tone: 'error', duration: 5000 })
        setDocsWorking(false)
      }
    }
    reader.onerror = () => {
      const message = 'No se pudo leer el archivo'
      setDocsWorking(false)
      setDocsError(message)
      showToast(message, { tone: 'error', duration: 5000 })
    }
    setDocsWorking(true)
    reader.readAsDataURL(file)
  }

  const handleConfirmDocRename = useCallback(async () => {
    if (!pendingDocUpload){
      setDocRenamePrompt(null)
      return
    }
    await performDocUpload(pendingDocUpload, { strategy: 'rename' })
  }, [pendingDocUpload, performDocUpload])

  const handleCancelDocRename = useCallback(() => {
    setDocRenamePrompt(null)
    setPendingDocUpload(null)
  }, [])

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
  const decisionDays = getDecisionDays(payload)
  const { className: decisionBadgeClass, label: decisionLabel } = getDecisionBadge(decisionDays)
  const normalizedPayloadSlug = normalizeSlug(payload.id)
  const canLoadInvestor = Boolean(normalizedPayloadSlug)
  const effectiveDocSlug = normalizeSlug(docSlug) || DEFAULT_INVESTOR_ID

  const investorNameBySlug = React.useMemo(() => {
    const map = {}
    investorList.forEach(item => {
      map[item.slug] = item.name || item.slug
    })
    return map
  }, [investorList])

  const pipelineSummary = React.useMemo(() => {
    const total = investorList.length
    const normalizedStages = PIPELINE_STAGES.map(stage => stage.toLowerCase())
    const stageCounts = PIPELINE_STAGES.map(stage => {
      const normalizedStage = stage.toLowerCase()
      const count = investorList.filter(item => (item.status || '').trim().toLowerCase() === normalizedStage).length
      const percent = total ? (count / total) * 100 : 0
      return { stage, count, percent }
    })
    const othersCount = investorList.reduce((acc, item) => {
      const normalizedStatus = (item.status || '').trim().toLowerCase()
      if (!normalizedStatus) return acc
      return normalizedStages.includes(normalizedStatus) ? acc : acc + 1
    }, 0)
    if (othersCount > 0){
      stageCounts.push({ stage: 'Otros', count: othersCount, percent: total ? (othersCount / total) * 100 : 0 })
    }
    const finalNormalized = finalStageLabel.toLowerCase()
    const finalCount = investorList.filter(item => (item.status || '').trim().toLowerCase() === finalNormalized).length
    const finalPercent = total ? (finalCount / total) * 100 : 0
    return { total, counts: stageCounts, finalCount, finalPercent }
  }, [investorList, finalStageLabel])

  const upcomingDeadlines = React.useMemo(() => {
    if (deadlineThreshold < 0) return []
    const thresholdMs = deadlineThreshold * 24 * 60 * 60 * 1000
    const now = new Date()
    const items = []
    Object.entries(investorDetailsMap).forEach(([slug, detail]) => {
      const deadlines = detail?.deadlines || {}
      const investorName = detail?.name || investorNameBySlug[slug] || slug
      Object.entries(deadlines).forEach(([label, value]) => {
        if (!value) return
        if (!/loi/i.test(label) && !/firma/i.test(label)) return
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return
        const diffMs = date.getTime() - now.getTime()
        const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
        if (days < 0) return
        if (diffMs <= thresholdMs){
          const formattedDate = shortDateFormatter.format(date)
          const docTarget = resolveDeadlineDocTarget(label)
          items.push({
            slug,
            label,
            date: value,
            days,
            investorName,
            formattedDate,
            dueText: days === 0 ? 'Vence hoy' : `Vence en ${days} día${days === 1 ? '' : 's'}`,
            docTarget
          })
        }
      })
    })
    items.sort((a, b) => {
      if (a.days !== b.days) return a.days - b.days
      return (a.investorName || '').localeCompare(b.investorName || '', 'es', { sensitivity: 'base' })
    })
    return items
  }, [investorDetailsMap, deadlineThreshold, investorNameBySlug, shortDateFormatter])

  const docHealthSummary = React.useMemo(() => {
    return DASHBOARD_DOC_CATEGORIES.map(category => {
      const categoryData = docInventories[category] || {}
      const missing = investorList.reduce((acc, investor) => {
        const entry = categoryData[investor.slug]
        const files = Array.isArray(entry?.files) ? entry.files : []
        if (!files.length){
          acc.push({
            slug: investor.slug,
            name: investor.name || investor.slug,
            error: entry?.error || null
          })
        }
        return acc
      }, [])
      let folderTarget = null
      for (const investor of investorList){
        const entry = categoryData[investor.slug]
        const files = Array.isArray(entry?.files) ? entry.files : []
        if (files.length){
          folderTarget = { slug: investor.slug, file: files[0] }
          break
        }
      }
      const fallbackSlug = missing.length ? missing[0].slug : (investorList[0]?.slug || DEFAULT_INVESTOR_ID)
      return {
        category,
        missing,
        hasAll: investorList.length > 0 && missing.length === 0,
        folderTarget,
        fallbackSlug,
        total: investorList.length
      }
    })
  }, [docInventories, investorList])

  const activityDisplayItems = React.useMemo(() => {
    return activityItems.map((event, index) => {
      const slug = event?.slug || ''
      const investorName = slug ? (investorNameBySlug[slug] || slug) : ''
      let icon = '•'
      let title = event?.message || 'Actividad'
      let detail = ''
      switch(event?.type){
        case 'investor-created':
          icon = '🆕'
          title = investorName ? `Alta de inversionista ${investorName}` : 'Alta de inversionista'
          break
        case 'investor-deleted':
          icon = '🗑️'
          title = investorName ? `Baja de inversionista ${investorName}` : 'Baja de inversionista'
          break
        case 'investor-updated':
          icon = '✏️'
          title = investorName ? `Actualización de ${investorName}` : 'Actualización de inversionista'
          break
        case 'doc-uploaded':
          icon = '📄'
          title = `Documento subido (${event.category || 'Docs'})`
          detail = [event.filename, investorName].filter(Boolean).join(' · ')
          break
        case 'doc-deleted':
          icon = '🗑️'
          title = `Documento eliminado (${event.category || 'Docs'})`
          detail = [event.filename, investorName].filter(Boolean).join(' · ')
          break
        default:
          title = event?.message || title
      }
      const dateValue = event?.date ? new Date(event.date) : null
      const dateLabel = dateValue && !Number.isNaN(dateValue.getTime())
        ? dateTimeFormatter.format(dateValue)
        : (event?.date || '—')
      return {
        key: `${event?.sha || index}-${event?.path || index}`,
        icon,
        title,
        detail,
        dateLabel
      }
    })
  }, [activityItems, investorNameBySlug, dateTimeFormatter])

  const handleDeadlineThresholdChange = (e) => {
    const value = Number(e.target.value)
    if (Number.isNaN(value)){
      setDeadlineThreshold(0)
    }else{
      setDeadlineThreshold(Math.max(0, value))
    }
  }

  const navigateToDocsSection = (category, slug, target = 'upload') => {
    const normalizedCategory = DOCUMENT_SECTIONS_ORDER.includes(category) ? category : DEFAULT_DOC_CATEGORY
    const normalizedSlug = normalizeSlug(slug) || DEFAULT_INVESTOR_ID
    setDocsNotice(null)
    setDocsError(null)
    setDocCategory(normalizedCategory)
    setDocSlugInput(normalizedSlug)
    setDocSlug(normalizedSlug)
    if (typeof window !== 'undefined'){
      window.setTimeout(() => {
        if (docsCardRef.current){
          docsCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        if (target === 'upload' && docsUploadInputRef.current){
          docsUploadInputRef.current.focus()
        }else if (target === 'folder' && docsTableRef.current){
          docsTableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 60)
    }
  }

  const handleRefreshDocInventories = () => setDocRefreshKey(value => value + 1)
  const handleRefreshActivity = () => setActivityRefreshKey(value => value + 1)

  const handleLoadInvestor = async () => {
    const slug = normalizeSlug(payload.id)
    if (!slug){
      setErr('El slug (id) es requerido para cargar datos')
      return
    }
    setMsg(null)
    setErr(null)
    setDeadlinesMsg(null)
    setDeadlinesErr(null)
    setInvestorLoading(true)
    try {
      const data = await api.getInvestor(slug)
      setPayload(prev => ({
        ...prev,
        ...data,
        id: slug,
        metrics: withoutDecisionTime(data.metrics),
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


  const onSubmit = async (e) => {
    e.preventDefault()
    setMsg(null); setErr(null)
    setDeadlinesMsg(null)
    setDeadlinesErr(null)
    try{
      const normalizedId = normalizeSlug(payload.id)
      if (!normalizedId){
        throw new Error('El slug (id) es requerido')
      }

      const metricsPayload = payload.metrics || {}
      const sanitizedMetrics = withoutDecisionTime(metricsPayload)
      const normalizedMetrics = {
        ...sanitizedMetrics,
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
      const deadlineValidation = validateRows(deadlineRows)
      if (!deadlineValidation.ok){
        throw new Error(deadlineValidation.message)
      }
      const normalizedDeadlines = deadlineValidation.deadlines

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

  const handleDeadlinesChange = (rows) => {
    setDeadlineRows(ensureDeadlineRows(rows))
    setDeadlinesMsg(null)
    setDeadlinesErr(null)
  }

  const handleDeadlinesSubmit = async (rows) => {
    setDeadlinesMsg(null)
    setDeadlinesErr(null)
    const validation = validateRows(rows)
    if (!validation.ok){
      setDeadlinesErr(validation.message)
      return
    }
    const normalizedId = normalizeSlug(payload.id)
    if (!normalizedId){
      setDeadlinesErr('El slug (id) es requerido')
      return
    }

    setDeadlinesSaving(true)
    try {
      const deadlines = validation.deadlines
      const response = await fetch('/.netlify/functions/update-investor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: normalizedId, deadlines })
      })
      if (!response.ok){
        const text = await response.text()
        throw new Error(text || 'No se pudo guardar deadlines')
      }
      setPayload(prev => ({ ...prev, id: normalizedId, deadlines }))
      setDeadlineRows(deadlinesToRows(deadlines))
      setDeadlineFormKey(value => value + 1)
      setDeadlinesMsg('Deadlines guardados correctamente.')
    } catch (error) {
      setDeadlinesErr(error.message)
    } finally {
      setDeadlinesSaving(false)
    }
  }

  const onCreate = async (e) => {
    e.preventDefault()
    setInvMsg(null)
    setInvErr(null)
    setInvLoading(true)
    setProgress(15)
    try{
      const createValidation = validateRows(inv.deadlines)

      if (!createValidation.ok){
        throw new Error(createValidation.message)
      }

      const dl = createValidation.deadlines

      const payload = { email: inv.email, companyName: inv.companyName, status: inv.status, deadlines: dl }
      if (inv.slug) payload.slug = inv.slug
      const res = await api.createInvestor(payload)
      setProgress(100)
      setInvMsg(res.link)
      showToast('Inversionista creado correctamente.', { tone: 'success' })
      try{ await navigator.clipboard.writeText(res.link) }catch{}
      setInv(prev => ({ ...prev, deadlines: deadlinesToRows(dl) }))
      setInvDeadlinesKey(value => value + 1)
    }catch(error){
      setProgress(0)
      if (error?.status === 409 && error?.data?.error === 'INVESTOR_EXISTS'){
        const conflictSlug = error.data?.slug || normalizeSlug(inv.slug || inv.companyName || '') || 'desconocido'
        showToast(`Este inversionista ya existe (slug: ${conflictSlug}).`, { tone: 'warning', duration: 5000 })
      }else{
        const message = error?.message || 'Error al crear inversionista'
        setInvErr(`Error al crear inversionista: ${message}`)
        showToast(message, { tone: 'error', duration: 5000 })
      }
    }finally{ setInvLoading(false) }
  }

  return (
    <RoleGate user={user} allow={['admin','ri']}>
      <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
        <aside
          style={{
            width: 280,
            flexShrink: 0,
            padding: '24px 16px',
            boxSizing: 'border-box'
          }}
        >
          <Card style={{ padding: 20, position: 'sticky', top: 24 }}>
            <div className="title h2" style={{ marginBottom: 8 }}>
              Panel admin
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              Gestiona inversionistas, documentos y deadlines desde este panel.
            </p>
            <ul style={{ listStyle: 'disc', margin: '16px 0 0 20px', padding: 0, color: 'var(--muted)', fontSize: 13 }}>
              <li>Revisa el pipeline global.</li>
              <li>Actualiza documentos críticos.</li>
              <li>Gestiona deadlines y proyectos.</li>
            </ul>
          </Card>
        </aside>
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'linear-gradient(180deg,#fff,rgba(255,255,255,.85))',
              backdropFilter: 'blur(6px)',
              borderBottom: '1px solid rgba(0,0,0,.06)'
            }}
          >
            <div
              style={{
                maxWidth: 1100,
                margin: '0 auto',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div className="h1" style={{ margin: 0, color: 'var(--brand)' }}>
                  Panel de administración
                </div>
                <p className="help" style={{ margin: '4px 0 0' }}>
                  Accede a métricas clave, administra inversionistas y cuida los deadlines.
                </p>
              </div>
              <span className="badge">Dealroom Finsolar</span>
            </div>
          </header>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div
              style={{
                maxWidth: 1120,
                margin: '24px auto',
                padding: '0 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 24
              }}
            >
                    {isAdmin && (
                      <div className="grid-2">
                      <Section
                        title="Pipeline global"
                        style={{ gridColumn: '1 / -1' }}
                        actions={investorListLoading ? <span className="badge">Actualizando…</span> : null}
                      >
                        <div className="help" style={{ marginBottom: 12 }}>
                          Total inversionistas: {numberFormatter.format(pipelineSummary.total || 0)}
                        </div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>Avance hacia {finalStageLabel || 'cierre'}</div>
                          <div className="progress" style={{ marginTop: 6, height: 12 }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, pipelineSummary.finalPercent || 0))}%` }} />
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                            {numberFormatter.format(pipelineSummary.finalCount || 0)} / {numberFormatter.format(pipelineSummary.total || 0)} · {percentFormatter.format(Number.isFinite(pipelineSummary.finalPercent) ? pipelineSummary.finalPercent : 0)}%
                          </div>
                        </div>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {pipelineSummary.counts.map(item => {
                            const safePercent = Number.isFinite(item.percent) ? item.percent : 0
                            return (
                              <div key={item.stage} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
                                  <span>{item.stage}</span>
                                  <span>{numberFormatter.format(item.count)} · {percentFormatter.format(safePercent)}%</span>
                                </div>
                                <div className="progress" style={{ marginTop: 6, height: 8 }}>
                                  <div style={{ width: `${Math.min(100, Math.max(0, safePercent))}%` }} />
                                </div>
                              </div>
                            )
                          })}
                          {!pipelineSummary.total && (
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin inversionistas cargados.</div>
                          )}
                        </div>
                      </Section>

                      <Section
                        title="Inversionistas activos"
                        actions={
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={loadInvestorList}
                            disabled={investorListLoading}
                          >
                            {investorListLoading ? 'Actualizando…' : 'Actualizar'}
                          </Button>
                        }
                      >
                        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--brand)' }}>
                          {investorListLoading ? '—' : numberFormatter.format(pipelineSummary.total || 0)}
                        </div>
                        <div className="help">Total dados de alta</div>
                        {investorListError && <div className="notice" style={{ marginTop: 12 }}>{investorListError}</div>}
                      </Section>

                      <Section
                        title="Alertas de fechas próximas"
                        actions={investorDetailsLoading ? <span className="badge">Cargando…</span> : null}
                      >
                        <FormRow label="Mostrar alertas de">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Input
                              type="number"
                              min="0"
                              value={deadlineThreshold}
                              onChange={handleDeadlineThresholdChange}
                              style={{ width: 90 }}
                            />
                            <span className="help">días</span>
                          </div>
                        </FormRow>
                        {upcomingDeadlines.length === 0 && !investorDetailsLoading ? (
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin alertas dentro del rango configurado.</div>
                        ) : (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                            {upcomingDeadlines.map(item => {
                              const dateLabel = item.formattedDate || item.date || '—'
                              const dueLabel = item.dueText || (item.days === 0
                                ? 'Vence hoy'
                                : `Vence en ${item.days} día${item.days === 1 ? '' : 's'}`)
                              return (
                                <li key={`${item.slug}-${item.label}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{item.investorName}</div>
                                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                        {item.label} · {dueLabel} ({dateLabel})
                                      </div>
                                    </div>
                                    {item.docTarget && (
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => navigateToDocsSection(
                                          item.docTarget.category,
                                          item.slug,
                                          item.docTarget.target || 'upload'
                                        )}
                                      >
                                        Ir a {item.docTarget.category}
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                        {investorDetailsError && <div className="notice" style={{ marginTop: 12 }}>{investorDetailsError}</div>}
                      </Section>

                      <Section
                        title="Faltan documentos"
                        actions={
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleRefreshDocInventories}
                            disabled={docHealthLoading}
                          >
                            {docHealthLoading ? 'Verificando…' : 'Revisar'}
                          </Button>
                        }
                      >
                        <p style={{ margin: '4px 0 12px', color: 'var(--muted)', fontSize: 13 }}>
                          Estatus por categorías clave.
                        </p>
                        {!investorList.length ? (
                          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Da de alta inversionistas para revisar su documentación.</div>
                        ) : !docInventoriesReady ? (
                          docHealthLoading
                            ? <div style={{ fontSize: 13, color: 'var(--muted)' }}>Verificando documentación…</div>
                            : <div style={{ fontSize: 13, color: 'var(--muted)' }}>No se pudo obtener el estado actual.</div>
                        ) : (
                          docHealthSummary.map(summary => {
                            const previewNames = summary.missing.slice(0, 3).map(item => item.name).join(', ')
                            const remaining = summary.missing.length - Math.min(summary.missing.length, 3)
                            const hasErrors = summary.missing.some(item => item.error)
                            const disabledFolder = summary.total === 0
                            return (
                              <div key={summary.category} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <span style={{ fontSize: 20, lineHeight: 1 }}>{summary.hasAll ? '✅' : '⛔'}</span>
                                    <div>
                                      <div style={{ fontWeight: 700 }}>{summary.category}</div>
                                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                                        {summary.total === 0
                                          ? 'Sin inversionistas registrados.'
                                          : summary.hasAll
                                            ? 'Documentación completa.'
                                            : `Faltan ${summary.missing.length} de ${summary.total}.`}
                                      </div>
                                      {!summary.hasAll && summary.missing.length > 0 && (
                                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                                          {previewNames}
                                          {remaining > 0 && ` +${remaining} más`}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => navigateToDocsSection(summary.category, summary.fallbackSlug, 'upload')}
                                    >
                                      Subir
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={() => navigateToDocsSection(
                                        summary.category,
                                        (summary.folderTarget && summary.folderTarget.slug) || summary.fallbackSlug,
                                        'folder'
                                      )}
                                      disabled={disabledFolder}
                                    >
                                      Carpeta
                                    </Button>
                                  </div>
                                </div>
                                {hasErrors && (
                                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                                    Algunos registros devolvieron errores al consultar sus carpetas.
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                        {docHealthError && <div className="notice" style={{ marginTop: 12 }}>{docHealthError}</div>}
                      </Section>

                      <Section
                        title="Actividad reciente"
                        style={{ gridColumn: '1 / -1' }}
                        actions={
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleRefreshActivity}
                            disabled={activityLoading}
                          >
                            {activityLoading ? 'Consultando…' : 'Actualizar'}
                          </Button>
                        }
                      >
                        {activityError && <div className="notice" style={{ marginTop: 12 }}>{activityError}</div>}
                        {activityLoading && <div style={{ marginTop: 12, color: 'var(--muted)' }}>Consultando actividad…</div>}
                        {!activityLoading && !activityError && activityDisplayItems.length === 0 && (
                          <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: 13 }}>Sin eventos recientes.</div>
                        )}
                        {activityDisplayItems.length > 0 && (
                          <ul style={{ listStyle: 'none', margin: 12, marginTop: 12, padding: 0, display: 'grid', gap: 10 }}>
                            {activityDisplayItems.map(item => (
                              <li key={item.key} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                  <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{item.title}</div>
                                    {item.detail && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.detail}</div>}
                                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.dateLabel}</div>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Section>
                      </div>
                    )}
                    <Section title="Alta de inversionista">
                      <form onSubmit={onCreate} aria-busy={invLoading} style={{ display: 'grid', gap: 16 }}>
                        <div className="grid-2">
                          <FormRow label="Email corporativo">
                            <Input
                              type="email"
                              placeholder="Email corporativo"
                              value={inv.email}
                              onChange={e => setInv({ ...inv, email: e.target.value })}
                              required
                            />
                          </FormRow>
                          <FormRow label="Nombre de la empresa">
                            <Input
                              placeholder="Nombre de la empresa"
                              value={inv.companyName}
                              onChange={e => setInv({ ...inv, companyName: e.target.value })}
                              required
                            />
                          </FormRow>
                          <FormRow label="Slug deseado (opcional)">
                            <Input
                              placeholder="Slug opcional"
                              value={inv.slug}
                              onChange={e => setInv({ ...inv, slug: e.target.value })}
                            />
                          </FormRow>
                          <FormRow label="Estado inicial">
                            <Select value={inv.status} onChange={e => setInv({ ...inv, status: e.target.value })}>
                              {PIPELINE_STAGES.map(s => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          </FormRow>
                        </div>
                        <div>
                          <span className="label">Deadlines</span>
                          <DeadlinesForm
                            key={invDeadlinesKey}
                            initial={inv.deadlines}
                            onChange={rows => setInv(prev => ({ ...prev, deadlines: ensureDeadlineRows(rows) }))}
                            hideSubmit
                          />
                        </div>
                        <Toolbar>
                          <Button type="submit" disabled={invLoading}>
                            {invLoading ? 'Creando…' : 'Crear'}
                          </Button>
                        </Toolbar>
                      </form>
                      {invLoading && (
                        <div className="progress" style={{ marginTop: 8 }}>
                          <div style={{ width: progress + '%' }} />
                        </div>
                      )}
                      {invMsg && (
                        <div className="notice" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ wordBreak: 'break-all' }}>{invMsg}</span>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => navigator.clipboard && navigator.clipboard.writeText(invMsg)}
                          >
                            Copiar
                          </Button>
                        </div>
                      )}
                      {invErr && <div className="notice" style={{ marginTop: 8 }}>{invErr}</div>}
                    </Section>
                    {isAdmin && (
                      <Section title="Inversionistas activos">
                        <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
                          Consulta los inversionistas dados de alta y dales de baja cuando sea necesario.
                        </p>
                        <Toolbar style={{ marginBottom: 12 }}>
                          <Input
                            placeholder="Buscar por nombre, correo o slug"
                            value={investorSearch}
                            onChange={e => setInvestorSearch(e.target.value)}
                            style={{ flex: 1, minWidth: 220 }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={loadInvestorList}
                            disabled={investorListLoading}
                          >
                            {investorListLoading ? 'Actualizando...' : 'Actualizar lista'}
                          </Button>
                        </Toolbar>
                        {investorListError && <div className="notice" style={{ marginBottom: 12 }}>{investorListError}</div>}
                        {investorDeleteErr && <div className="notice" style={{ marginBottom: 12 }}>{investorDeleteErr}</div>}
                        {investorDeleteMsg && <div className="notice" style={{ marginBottom: 12 }}>{investorDeleteMsg}</div>}
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                          {investorListLoading
                            ? 'Cargando inversionistas...'
                            : `${filteredInvestorCount} inversionista${filteredInvestorCount === 1 ? '' : 's'} coincidente${filteredInvestorCount === 1 ? '' : 's'}`}
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table">
                            <thead>
                              <tr>
                                <th style={{ minWidth: 140 }}>Empresa</th>
                                <th style={{ minWidth: 180 }}>Correo</th>
                                <th style={{ minWidth: 100 }}>Slug</th>
                                <th style={{ minWidth: 120 }}>Estado</th>
                                <th style={{ minWidth: 120 }}>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {investorListLoading && (
                                <tr>
                                  <td colSpan={5} style={{ paddingTop: 12, paddingBottom: 12 }}>Cargando datos...</td>
                                </tr>
                              )}
                              {!investorListLoading &&
                                filteredInvestors.map(item => (
                                  <tr key={item.slug}>
                                    <td>{item.name || '—'}</td>
                                    <td>{item.email || '—'}</td>
                                    <td>{item.slug}</td>
                                    <td>{item.status || '—'}</td>
                                    <td>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => handleDeleteInvestor(item.slug)}
                                        disabled={deletingInvestor === item.slug}
                                      >
                                        {deletingInvestor === item.slug ? 'Eliminando...' : 'Eliminar'}
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              {!investorListLoading && filteredInvestors.length === 0 && (
                                <tr>
                                  <td colSpan={5} style={{ paddingTop: 12, paddingBottom: 12, color: 'var(--muted)' }}>
                                    No se encontraron inversionistas con los criterios actuales.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Section>
                    )}
                    <Section title="Actualizar estado de inversionista">
                      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 20 }}>
                        <div className="grid-2">
                          <FormRow label="Slug (id)">
                            <Input
                              placeholder="slug (id)"
                              value={payload.id}
                              onChange={e => setPayload({ ...payload, id: e.target.value })}
                            />
                          </FormRow>
                          <FormRow label="Nombre">
                            <Input
                              placeholder="Nombre"
                              value={payload.name}
                              onChange={e => setPayload({ ...payload, name: e.target.value })}
                            />
                          </FormRow>
                          <FormRow label="Estado">
                            <Select value={payload.status} onChange={e => setPayload({ ...payload, status: e.target.value })}>
                              {PIPELINE_STAGES.map(s => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          </FormRow>
                        </div>

                        <Toolbar>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleLoadInvestor}
                            disabled={investorLoading || !canLoadInvestor}
                          >
                            {investorLoading ? 'Cargando...' : 'Cargar datos'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleOpenPanelModal}
                            disabled={!canLoadInvestor}
                          >
                            Ver panel
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleOpenDeleteModal}
                            disabled={!canLoadInvestor || deletingInvestor === normalizedPayloadSlug}
                          >
                            {deletingInvestor === normalizedPayloadSlug ? 'Eliminando...' : 'Eliminar'}
                          </Button>
                        </Toolbar>

                        <div>
                          <span className="label">Deadlines</span>
                          <DeadlinesForm
                            key={deadlineFormKey}
                            initial={deadlineRows}
                            onChange={handleDeadlinesChange}
                            onSubmit={handleDeadlinesSubmit}
                            saving={deadlinesSaving}
                          />
                          {deadlinesMsg && <div className="notice" style={{ marginTop: 8 }}>{deadlinesMsg}</div>}
                          {deadlinesErr && <div className="notice" style={{ marginTop: 8 }}>{deadlinesErr}</div>}
                        </div>

                        <div style={{ display: 'grid', gap: 16 }}>
                          <div>
                            <span className="label">Días a decisión</span>
                            <span className={decisionBadgeClass}>{decisionLabel}</span>
                          </div>
                          <div className="grid-2">
                            <FormRow label="Inversión de capital fiscal (MXN)">
                              <Input
                                id="metric-fiscal"
                                type="number"
                                min="0"
                                step="any"
                                value={metrics.fiscalCapitalInvestment ?? ''}
                                onChange={e => updateMetric('fiscalCapitalInvestment', e.target.value)}
                              />
                            </FormRow>
                            <FormRow label="Utilidad de proyecto (MXN)">
                              <Input
                                id="metric-project-amount"
                                type="number"
                                min="0"
                                step="any"
                                value={projectProfitability.amount ?? ''}
                                onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), amount: e.target.value }))}
                              />
                            </FormRow>
                            <FormRow label="Horizonte (años)">
                              <Input
                                id="metric-project-years"
                                type="number"
                                min="0"
                                value={projectProfitability.years ?? ''}
                                onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), years: e.target.value }))}
                              />
                            </FormRow>
                            <FormRow label="Portafolio">
                              <Select
                                id="metric-portfolio-type"
                                value={portfolio.type || ''}
                                onChange={e => handlePortfolioTypeChange(e.target.value)}
                              >
                                <option value="">Selecciona una opción</option>
                                {PORTFOLIO_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </Select>
                            </FormRow>
                          </div>

                          {isPortfolioMix && (
                            <div style={{ display: 'grid', gap: 12 }}>
                              <div className="grid-3">
                                {MIX_FIELDS.map(field => (
                                  <FormRow key={field.key} label={`${field.label} (%)`}>
                                    <Input
                                      id={`metric-portfolio-${field.key}`}
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="any"
                                      value={mixValues[field.key] ?? ''}
                                      onChange={e => handleMixChange(field.key, e.target.value)}
                                    />
                                  </FormRow>
                                ))}
                              </div>
                              <div className="help">Suma: {mixTotal}%</div>
                            </div>
                          )}
                        </div>

                        <Toolbar>
                          <Button type="submit">Guardar</Button>
                        </Toolbar>
                      </form>
                      {msg && <div className="notice" style={{ marginTop: 8 }}>{msg}</div>}
                      {err && <div className="notice" style={{ marginTop: 8 }}>{err}</div>}
                    </Section>
                    <Section title="Documentos por inversionista" style={{ marginTop: 12 }} ref={docsCardRef}>
                      <form onSubmit={handleDocSlugSubmit} style={{ display: 'grid', gap: 16 }}>
                        <div className="grid-2">
                          <FormRow label="Slug del inversionista">
                            <Input
                              id="docs-slug"
                              value={docSlugInput}
                              onChange={e => setDocSlugInput(e.target.value)}
                              placeholder="slug"
                            />
                          </FormRow>
                          <FormRow label="Categoría">
                            <Select
                              id="docs-category"
                              value={docCategory}
                              onChange={e => {
                                setDocCategory(e.target.value)
                                setDocsNotice(null)
                                setDocsError(null)
                              }}
                            >
                              {DOCUMENT_SECTIONS_ORDER.map(cat => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </Select>
                          </FormRow>
                        </div>
                        <Toolbar>
                          <Button type="submit" disabled={docsLoading || docsWorking}>
                            Ver carpeta
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setDocsNotice(null)
                              setDocsError(null)
                              loadDocs()
                            }}
                            disabled={docsLoading || docsWorking}
                          >
                            Actualizar
                          </Button>
                        </Toolbar>
                      </form>
                      <div className="help" style={{ marginTop: 8 }}>
                        Gestionando: <code>{docCategory}/{effectiveDocSlug}</code>
                      </div>
                      <form
                        onSubmit={handleDocUpload}
                        style={{ marginTop: 16, display: 'grid', gap: 12 }}
                        aria-busy={docsWorking}
                      >
                        <Input name="file" type="file" disabled={docsWorking} ref={docsUploadInputRef} />
                        <Toolbar>
                          <Button type="submit" disabled={docsWorking}>
                            {docsWorking ? 'Subiendo…' : 'Subir'}
                          </Button>
                          <span className="help">Los archivos se guardan en GitHub.</span>
                        </Toolbar>
                      </form>
                      {docsError && <div className="notice" style={{ marginTop: 8 }}>{docsError}</div>}
                      {docsNotice && <div className="notice" style={{ marginTop: 8 }}>{docsNotice}</div>}
                      {docsWorking && !docsLoading && <div style={{ marginTop: 8, color: 'var(--muted)' }}>Procesando...</div>}
                      {docsLoading && <div style={{ marginTop: 8, color: 'var(--muted)' }}>Cargando documentos...</div>}
                      <table className="table" style={{ marginTop: 12 }} ref={docsTableRef}>
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
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => handleDocDelete(file)}
                                  disabled={docsWorking}
                                >
                                  Eliminar
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {!docList.length && !docsLoading && (
                            <tr>
                              <td colSpan={3}>No hay documentos en esta carpeta.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Section>
                    {docRenamePrompt && (
                      <div style={modalBackdropStyle} role="dialog" aria-modal="true" aria-labelledby="doc-rename-title">
                        <div style={modalCardStyle}>
                          <div className="h2" id="doc-rename-title" style={{ marginTop: 0 }}>Archivo duplicado</div>
                          <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 14 }}>
                            Ya existe un archivo con ese nombre. ¿Quieres subirlo con un sufijo automático?
                          </p>
                          <p style={{ fontSize: 13 }}>
                            <code>{docRenamePrompt.path}</code>
                          </p>
                          <div style={modalButtonRowStyle}>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleCancelDocRename}
                              disabled={docsWorking}
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={handleConfirmDocRename}
                              disabled={docsWorking}
                              aria-busy={docsWorking}
                            >
                              {docsWorking ? 'Subiendo…' : 'Renombrar y subir'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <Section title="Gestionar proyectos activos" style={{ marginTop: 12 }}>
                      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
                        Actualiza la lista que aparece en la sección de Proyectos.
                      </p>
                      {projectLoadErr && <div className="notice" style={{ marginTop: 8 }}>{projectLoadErr}</div>}
                      {projectsLoading ? (
                        <div style={{ marginTop: 8, color: 'var(--muted)' }}>Cargando proyectos...</div>
                      ) : (
                        <form onSubmit={onSaveProjects} style={{ display: 'grid', gap: 20 }}>
                          {projectList.map((project, index) => (
                            <Card key={project.id || index} style={{ padding: 20, display: 'grid', gap: 16 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                <div className="h2" style={{ margin: 0, fontSize: 18 }}>
                                  {project.name || project.id || `Proyecto ${index + 1}`}
                                </div>
                                <Button type="button" variant="secondary" onClick={() => removeProject(index)}>
                                  Eliminar
                                </Button>
                              </div>
                              <div className="grid-3">
                                <FormRow label="ID">
                                  <Input
                                    id={`project-${index}-id`}
                                    value={project.id}
                                    onChange={e => updateProjectField(index, 'id', e.target.value)}
                                  />
                                </FormRow>
                                <FormRow label="Nombre">
                                  <Input
                                    id={`project-${index}-name`}
                                    value={project.name}
                                    onChange={e => updateProjectField(index, 'name', e.target.value)}
                                  />
                                </FormRow>
                                <FormRow label="Cliente">
                                  <Input
                                    id={`project-${index}-client`}
                                    value={project.client}
                                    onChange={e => updateProjectField(index, 'client', e.target.value)}
                                  />
                                </FormRow>
                              </div>
                              <div className="grid-2">
                                <FormRow label="Ubicación">
                                  <Input
                                    id={`project-${index}-location`}
                                    value={project.location}
                                    onChange={e => updateProjectField(index, 'location', e.target.value)}
                                  />
                                </FormRow>
                                <FormRow label="Estado">
                                  <Input
                                    id={`project-${index}-status`}
                                    value={project.status}
                                    onChange={e => updateProjectField(index, 'status', e.target.value)}
                                  />
                                </FormRow>
                              </div>
                              <div className="grid-3">
                                {PROJECT_NUMBER_FIELDS.map(field => (
                                  <FormRow key={field.key} label={field.label}>
                                    <Input
                                      id={`project-${index}-${field.key}`}
                                      type="number"
                                      min="0"
                                      step="any"
                                      value={project[field.key] ?? ''}
                                      onChange={e => updateProjectField(index, field.key, e.target.value)}
                                    />
                                  </FormRow>
                                ))}
                              </div>
                              <div className="grid-3">
                                <FormRow label="Plazo (meses)">
                                  <Input
                                    id={`project-${index}-termMonths`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={project.termMonths ?? ''}
                                    onChange={e => updateProjectField(index, 'termMonths', e.target.value)}
                                  />
                                </FormRow>
                                <FormRow label="Empresa">
                                  <Input
                                    id={`project-${index}-empresa`}
                                    value={project.empresa ?? ''}
                                    onChange={e => updateProjectField(index, 'empresa', e.target.value)}
                                    placeholder="Razón social / filial"
                                  />
                                </FormRow>
                                <FormRow label="Imagen (URL)">
                                  <Input
                                    id={`project-${index}-imageUrl`}
                                    type="url"
                                    placeholder="https://..."
                                    value={project.imageUrl ?? ''}
                                    onChange={e => updateProjectField(index, 'imageUrl', e.target.value)}
                                  />
                                  {project.imageUrl && /^https?:\/\//i.test(project.imageUrl) && (
                                    <div style={{ marginTop: 8 }}>
                                      <img
                                        src={project.imageUrl}
                                        alt={project.name || project.id || 'Proyecto'}
                                        style={{ maxWidth: 160, borderRadius: 8 }}
                                      />
                                    </div>
                                  )}
                                </FormRow>
                              </div>
                              <div className="grid-2">
                                <FormRow label="Notas">
                                  <Textarea
                                    id={`project-${index}-notes`}
                                    value={project.notes}
                                    onChange={e => updateProjectField(index, 'notes', e.target.value)}
                                    style={{ minHeight: 96 }}
                                  />
                                </FormRow>
                                <FormRow label="Enlace a LOI">
                                  <Input
                                    id={`project-${index}-loi`}
                                    type="url"
                                    placeholder="https://"
                                    value={project.loi_template}
                                    onChange={e => updateProjectField(index, 'loi_template', e.target.value)}
                                  />
                                </FormRow>
                              </div>
                            </Card>
                          ))}
                          {!projectList.length && (
                            <div className="help">No hay proyectos cargados. Usa "Agregar proyecto".</div>
                          )}
                          <Toolbar>
                            <Button type="button" variant="secondary" onClick={addProject}>
                              Agregar proyecto
                            </Button>
                            <Button type="submit" disabled={projectSaving}>
                              {projectSaving ? 'Guardando...' : 'Guardar proyectos'}
                            </Button>
                          </Toolbar>
                        </form>
                      )}
                      {projectSaveMsg && <div className="notice" style={{ marginTop: 8 }}>{projectSaveMsg}</div>}
                      {projectSaveErr && <div className="notice" style={{ marginTop: 8 }}>{projectSaveErr}</div>}
                    </Section>
                    <Section title="Notas" style={{ marginTop: 12 }}>
                      <ul>
                        <li>Este panel hace commits a GitHub (mismo repo) en <code>data/investors/&lt;slug&gt;.json</code>.</li>
                        <li>Netlify vuelve a construir el sitio y los cambios quedan visibles al instante.</li>
                      </ul>
                    </Section>
            </div>
          </div>
        </main>
      </div>
      {panelModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Panel público del inversionista</div>
            <p style={{ marginTop: 8, marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
              Comparte este enlace con el inversionista <code>{panelModal.slug}</code>.
            </p>
            <Input
              readOnly
              value={panelModal.url}
              style={{ marginTop: 4 }}
              onFocus={e => e.target.select()}
            />
            <div style={modalButtonRowStyle}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard){
                    navigator.clipboard.writeText(panelModal.url).catch(() => {})
                  }
                }}
              >
                Copiar enlace
              </Button>
              <a
                className="btn"
                href={panelModal.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir panel
              </a>
              <Button type="button" variant="secondary" onClick={handleClosePanelModal}>
                Cerrar
              </Button>
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
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseDeleteModal}
                disabled={deleteModalLoading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={confirmDeleteFromModal}
                disabled={deleteModalLoading}
              >
                {deleteModalLoading ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  )
}
