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
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Section } from '@/components/ui/Section'

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
  termMonths: 0,
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
    const parsed = parseInt(String(value ?? '').trim(), 10)
    if (!Number.isFinite(parsed)) return 0
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
    model: project.model || '',
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
    return (
    <RoleGate user={user} allow={['admin','ri']}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div
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
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              justifyContent: 'space-between',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="h1" style={{ color: 'var(--brand)' }}>Panel de administración</div>
              <span className="kpi">Dealroom Finsolar</span>
            </div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>
              {payload.name ? `Editando: ${payload.name}` : 'Selecciona o crea un inversionista'}
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '24px auto', padding: '0 20px', display: 'grid', gap: 16 }}>
          <Card>
            <div className="toolbar">
              <button
                type="button"
                className="btn"
                onClick={handleLoadInvestor}
                disabled={investorLoading || !canLoadInvestor}
              >
                {investorLoading ? 'Cargando…' : 'Cargar datos'}
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
                className="btn ghost"
                onClick={handleOpenDeleteModal}
                disabled={!canLoadInvestor || deletingInvestor === normalizedPayloadSlug}
              >
                {deletingInvestor === normalizedPayloadSlug ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </Card>

          <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
            <div className="two-col" style={{ display: 'grid', gap: 16 }}>
              <Section title="Datos del inversionista">
                <div style={{ display: 'grid', gap: 12 }}>
                  <Field label="Slug">
                    <input
                      className="input"
                      placeholder="femsa"
                      value={payload.id}
                      onChange={e => setPayload({ ...payload, id: e.target.value })}
                    />
                  </Field>
                  <Field label="Nombre">
                    <input
                      className="input"
                      placeholder="FEMSA"
                      value={payload.name}
                      onChange={e => setPayload({ ...payload, name: e.target.value })}
                    />
                  </Field>
                  <Field label="Estado">
                    <select
                      className="select"
                      value={payload.status}
                      onChange={e => setPayload({ ...payload, status: e.target.value })}
                    >
                      {PIPELINE_STAGES.map(stage => (
                        <option key={stage}>{stage}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Section>

              <Section
                title="Deadlines"
                actions={(
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleDeadlinesSubmit(Array.isArray(deadlineRows) ? deadlineRows : [])}
                    disabled={deadlinesSaving || !canLoadInvestor}
                  >
                    {deadlinesSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                )}
              >
                <DeadlinesForm
                  key={deadlineFormKey}
                  initial={deadlineRows}
                  onChange={handleDeadlinesChange}
                  saving={deadlinesSaving}
                  hideSubmit
                />
                {deadlinesMsg && <div className="notice" style={{ marginTop: 12 }}>{deadlinesMsg}</div>}
                {deadlinesErr && <div className="notice" style={{ marginTop: 12 }}>{deadlinesErr}</div>}
              </Section>
            </div>

            <Section title="Métricas clave">
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <Card style={{ padding: 20 }}>
                    <span className="label">Días a decisión</span>
                    <div className={decisionBadgeClass} style={{ fontSize: 24, fontWeight: 700 }}>
                      {decisionLabel}
                    </div>
                  </Card>
                  <Field label="Inversión de capital fiscal (MXN)" className="metric-field">
                    <input
                      id="metric-fiscal"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={metrics.fiscalCapitalInvestment ?? ''}
                      onChange={e => updateMetric('fiscalCapitalInvestment', e.target.value)}
                    />
                  </Field>
                  <Field label="Utilidad de proyecto (MXN)" className="metric-field">
                    <input
                      id="metric-project-amount"
                      className="input"
                      type="number"
                      min="0"
                      step="any"
                      value={projectProfitability.amount ?? ''}
                      onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), amount: e.target.value }))}
                    />
                  </Field>
                  <Field label="Horizonte (años)" className="metric-field">
                    <input
                      id="metric-project-years"
                      className="input"
                      type="number"
                      min="0"
                      value={projectProfitability.years ?? ''}
                      onChange={e => updateMetric('projectProfitability', current => ({ ...(current || {}), years: e.target.value }))}
                    />
                  </Field>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
                  <Field label="Inversionistas activos" className="metric-field">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={metrics.investorsActive ?? ''}
                      onChange={e => updateMetric('investorsActive', e.target.value)}
                    />
                  </Field>
                  <Field label="Deals acelerados" className="metric-field">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={metrics.dealsAccelerated ?? ''}
                      onChange={e => updateMetric('dealsAccelerated', e.target.value)}
                    />
                  </Field>
                  <Field label="NPS" className="metric-field">
                    <input
                      className="input"
                      type="number"
                      min="0"
                      value={metrics.nps ?? ''}
                      onChange={e => updateMetric('nps', e.target.value)}
                    />
                  </Field>
                  <Field label="Portafolio" className="metric-field">
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
                  </Field>
                </div>

                {isPortfolioMix && (
                  <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
                    {MIX_FIELDS.map(field => (
                      <Field key={field.key} label={`${field.label} (%)`} className="metric-field">
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
                      </Field>
                    ))}
                    <div style={{ alignSelf: 'end', fontSize: 12, color: 'var(--muted)' }}>Suma: {mixTotal}%</div>
                  </div>
                )}
              </div>
            </Section>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" type="submit">Guardar cambios</button>
            </div>

            {msg && <div className="notice">{msg}</div>}
            {err && <div className="notice">{err}</div>}
          </form>

          {isAdmin && (
            <div style={{ display: 'grid', gap: 16 }}>
              <Section
                title="Pipeline global"
                actions={investorListLoading ? <span className="badge">Actualizando…</span> : null}
              >
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 12 }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{item.stage}</span>
                          <span>{numberFormatter.format(item.count)} · {percentFormatter.format(safePercent)}%</span>
                        </div>
                        <div className="progress" style={{ marginTop: 6, height: 8 }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, safePercent))}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {pipelineSummary.others > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
                    Otros estados: {pipelineSummary.others}
                  </div>
                )}
              </Section>

              <Section
                title="Faltan documentos"
                actions={(
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleRefreshDocInventories}
                    disabled={docHealthLoading}
                  >
                    {docHealthLoading ? 'Verificando…' : 'Revisar'}
                  </button>
                )}
              >
                <p style={{ margin: '0 0 12px', color: 'var(--muted)', fontSize: 13 }}>
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
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between' }}>
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
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => navigateToDocsSection(summary.category, summary.fallbackSlug, 'upload')}
                            >
                              Subir
                            </button>
                            <button
                              type="button"
                              className="btn secondary"
                              onClick={() => navigateToDocsSection(summary.category, (summary.folderTarget && summary.folderTarget.slug) || summary.fallbackSlug, 'folder')}
                              disabled={disabledFolder}
                            >
                              Carpeta
                            </button>
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
                actions={(
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={handleRefreshActivity}
                    disabled={activityLoading}
                  >
                    {activityLoading ? 'Consultando…' : 'Actualizar'}
                  </button>
                )}
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
            <form onSubmit={onCreate} aria-busy={invLoading} style={{ display: 'grid', gap: 12 }}>
              <div className="form-row">
                <input className="input" type="email" placeholder="Email corporativo" value={inv.email} onChange={e => setInv({ ...inv, email: e.target.value })} required />
                <input className="input" placeholder="Nombre de la empresa" value={inv.companyName} onChange={e => setInv({ ...inv, companyName: e.target.value })} required />
                <input className="input" placeholder="Slug deseado (opcional)" value={inv.slug} onChange={e => setInv({ ...inv, slug: e.target.value })} />
                <select className="select" value={inv.status} onChange={e => setInv({ ...inv, status: e.target.value })}>
                  {PIPELINE_STAGES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <DeadlinesForm
                key={invDeadlinesKey}
                initial={inv.deadlines}
                onChange={rows => setInv(prev => ({ ...prev, deadlines: ensureDeadlineRows(rows) }))}
                hideSubmit
              />
              <button className="btn" type="submit" disabled={invLoading}>
                {invLoading ? 'Creando…' : 'Crear inversionista'}
              </button>
            </form>
            {invLoading && <div className="progress" style={{ marginTop: 8 }}><div style={{ width: progress + '%' }} /></div>}
            {invMsg && (
              <div className="notice" style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ wordBreak: 'break-all' }}>{invMsg}</span>
                <button className="btn secondary" type="button" onClick={() => navigator.clipboard && navigator.clipboard.writeText(invMsg)}>Copiar</button>
              </div>
            )}
            {invErr && <div className="notice" style={{ marginTop: 8 }}>{invErr}</div>}
          </Section>

          {isAdmin && (
            <Section title="Inversionistas activos">
              <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--muted)', fontSize: 14 }}>
                Consulta los inversionistas dados de alta y dales de baja cuando sea necesario.
              </p>
              <div className="form-row" style={{ marginBottom: 12 }}>
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
                  {investorListLoading ? 'Actualizando…' : 'Actualizar lista'}
                </button>
              </div>
              {investorListError && <div className="notice" style={{ marginBottom: 12 }}>{investorListError}</div>}
              {investorDeleteErr && <div className="notice" style={{ marginBottom: 12 }}>{investorDeleteErr}</div>}
              {investorDeleteMsg && <div className="notice" style={{ marginBottom: 12 }}>{investorDeleteMsg}</div>}
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>
                {investorListLoading
                  ? 'Cargando inversionistas…'
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
                        <td colSpan={5} style={{ paddingTop: 12, paddingBottom: 12 }}>Cargando datos…</td>
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
                            className="btn ghost"
                            onClick={() => handleDeleteInvestor(item.slug)}
                            disabled={deletingInvestor === item.slug}
                          >
                            {deletingInvestor === item.slug ? 'Eliminando…' : 'Eliminar'}
                          </button>
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

          <div ref={docsCardRef}>
            <Section title="Documentos por inversionista">
            <form
              onSubmit={handleDocSlugSubmit}
              className="form-row"
              style={{ marginTop: 8, alignItems: 'flex-end', gap: 12 }}
            >
              <Field label="Slug del inversionista" className="metric-field">
                <input
                  id="docs-slug"
                  className="input"
                  value={docSlugInput}
                  onChange={e => setDocSlugInput(e.target.value)}
                  placeholder="slug"
                />
              </Field>
              <Field label="Categoría" className="metric-field">
                <select
                  id="docs-category"
                  className="select"
                  value={docCategory}
                  onChange={e => { setDocCategory(e.target.value); setDocsNotice(null); setDocsError(null) }}
                >
                  {DOCUMENT_SECTIONS_ORDER.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </Field>
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
            <form onSubmit={handleDocUpload} className="form-row" style={{ marginTop: 12 }} aria-busy={docsWorking}>
              <input name="file" type="file" className="input" disabled={docsWorking} ref={docsUploadInputRef} />
              <button className="btn" type="submit" disabled={docsWorking}>
                {docsWorking ? 'Subiendo…' : 'Subir'}
              </button>
              <span className="notice">Los archivos se guardan en GitHub.</span>
            </form>
            {docsError && <div className="notice" style={{ marginTop: 8 }}>{docsError}</div>}
            {docsNotice && <div className="notice" style={{ marginTop: 8 }}>{docsNotice}</div>}
            {docsWorking && !docsLoading && <div style={{ marginTop: 8, color: 'var(--muted)' }}>Procesando…</div>}
            {docsLoading && <div style={{ marginTop: 8, color: 'var(--muted)' }}>Cargando documentos…</div>}
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
                      <button
                        type="button"
                        className="btn ghost"
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
                    <td colSpan={3}>No hay documentos en esta carpeta.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </Section>
          </div>

          <Section title="Proyectos disponibles">
            {projectsLoading && <div style={{ color: 'var(--muted)' }}>Cargando proyectos…</div>}
            {projectLoadErr && <div className="notice" style={{ marginTop: 8 }}>{projectLoadErr}</div>}
            {!projectsLoading && (
              <form onSubmit={onSaveProjects} style={{ display: 'grid', gap: 12 }}>
                {projectList.map((project, index) => (
                  <div key={project.id || index} style={projectBoxStyle}>
                    <div className="form-row">
                      <Field label="ID" className="metric-field">
                        <input
                          className="input"
                          value={project.id}
                          onChange={e => updateProjectField(index, 'id', e.target.value)}
                        />
                      </Field>
                      <Field label="Nombre" className="metric-field">
                        <input
                          className="input"
                          value={project.name}
                          onChange={e => updateProjectField(index, 'name', e.target.value)}
                        />
                      </Field>
                      <Field label="Cliente" className="metric-field">
                        <input
                          className="input"
                          value={project.client}
                          onChange={e => updateProjectField(index, 'client', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="form-row">
                      <Field label="Ubicación" className="metric-field">
                        <input
                          className="input"
                          value={project.location}
                          onChange={e => updateProjectField(index, 'location', e.target.value)}
                        />
                      </Field>
                      <Field label="Empresa" className="metric-field">
                        <input
                          className="input"
                          value={project.empresa}
                          onChange={e => updateProjectField(index, 'empresa', e.target.value)}
                        />
                      </Field>
                      <Field label="Modelo" className="metric-field">
                        <input
                          className="input"
                          value={project.model}
                          onChange={e => updateProjectField(index, 'model', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="form-row">
                      <Field label="Potencia (kWp)" className="metric-field">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={project.power_kwp}
                          onChange={e => updateProjectField(index, 'power_kwp', e.target.value)}
                        />
                      </Field>
                      <Field label="Energía anual (MWh)" className="metric-field">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={project.energy_mwh}
                          onChange={e => updateProjectField(index, 'energy_mwh', e.target.value)}
                        />
                      </Field>
                      <Field label="CO₂ evitado (t/año)" className="metric-field">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={project.co2_tons}
                          onChange={e => updateProjectField(index, 'co2_tons', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="form-row">
                      <Field label="Estado" className="metric-field">
                        <input
                          className="input"
                          value={project.status}
                          onChange={e => updateProjectField(index, 'status', e.target.value)}
                        />
                      </Field>
                      <Field label="Plazo (meses)" className="metric-field">
                        <input
                          className="input"
                          type="number"
                          min="0"
                          value={project.termMonths}
                          onChange={e => updateProjectField(index, 'termMonths', e.target.value)}
                        />
                      </Field>
                      <Field label="Imagen" className="metric-field">
                        <input
                          className="input"
                          value={project.imageUrl}
                          onChange={e => updateProjectField(index, 'imageUrl', e.target.value)}
                        />
                      </Field>
                    </div>
                    <div className="form-row">
                      <Field label="Notas" className="metric-field">
                        <textarea
                          className="input"
                          style={noteAreaStyle}
                          value={project.notes}
                          onChange={e => updateProjectField(index, 'notes', e.target.value)}
                        />
                      </Field>
                      <Field label="Enlace a LOI" className="metric-field">
                        <input
                          className="input"
                          type="url"
                          placeholder="https://"
                          value={project.loi_template}
                          onChange={e => updateProjectField(index, 'loi_template', e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                {!projectList.length && (
                  <div style={{ marginTop: 12, color: 'var(--muted)' }}>No hay proyectos cargados. Usa "Agregar proyecto".</div>
                )}
                <div className="toolbar" style={{ justifyContent: 'flex-end' }}>
                  <button type="button" className="btn secondary" onClick={addProject}>Agregar proyecto</button>
                  <button type="submit" className="btn" disabled={projectSaving}>
                    {projectSaving ? 'Guardando…' : 'Guardar proyectos'}
                  </button>
                </div>
              </form>
            )}
            {projectSaveMsg && <div className="notice" style={{ marginTop: 8 }}>{projectSaveMsg}</div>}
            {projectSaveErr && <div className="notice" style={{ marginTop: 8 }}>{projectSaveErr}</div>}
          </Section>

          <Section title="Notas">
            <ul>
              <li>Este panel hace commits a GitHub (mismo repo) en <code>data/investors/&lt;slug&gt;.json</code>.</li>
              <li>Netlify vuelve a construir el sitio y los cambios quedan visibles al instante.</li>
            </ul>
          </Section>
        </div>
      </div>

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
              <button
                type="button"
                className="btn secondary"
                onClick={handleCancelDocRename}
                disabled={docsWorking}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirmDocRename}
                disabled={docsWorking}
              >
                Subir con sufijo
              </button>
            </div>
          </div>
        </div>
      )}

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
              Se eliminará <code>data/investors/{deleteModal.slug}.json</code> y, si existe, la carpeta <code>data/docs/{deleteModal.slug}/</code>. Esta acción no se puede deshacer.
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
                {deleteModalLoading ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleGate>
  )
}
