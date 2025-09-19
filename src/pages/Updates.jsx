import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { DEFAULT_INVESTOR_ID } from '../lib/config'

const STAGES = [
  "Primera reunión","NDA","Entrega de información","Generación de propuesta",
  "Presentación de propuesta","Ajustes técnicos","LOI",
  "Due diligence fiscal/financiero/riesgos","Revisión de contratos",
  "Cronograma de inversión","Firma de contratos"
]

const DASHBOARD_DOC_CATEGORIES = ['NDA', 'Propuestas', 'Contratos']

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

export default function Updates(){
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [investorList, setInvestorList] = useState([])
  const [investorListLoading, setInvestorListLoading] = useState(false)
  const [investorListError, setInvestorListError] = useState(null)
  const [investorDetailsMap, setInvestorDetailsMap] = useState({})
  const [investorDetailsLoading, setInvestorDetailsLoading] = useState(false)
  const [investorDetailsError, setInvestorDetailsError] = useState(null)
  const [deadlineThreshold, setDeadlineThreshold] = useState(14)
  const [docInventories, setDocInventories] = useState({})
  const [docInventoriesReady, setDocInventoriesReady] = useState(false)
  const [docHealthLoading, setDocHealthLoading] = useState(false)
  const [docHealthError, setDocHealthError] = useState(null)
  const [docRefreshKey, setDocRefreshKey] = useState(0)
  const [activityItems, setActivityItems] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityError, setActivityError] = useState(null)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/data/updates.json')
      .then(r => r.json())
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  const finalStageLabel = STAGES[STAGES.length - 1] || ''
  const numberFormatter = useMemo(() => new Intl.NumberFormat('es-MX'), [])
  const percentFormatter = useMemo(
    () => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }),
    []
  )
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }),
    []
  )
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }),
    []
  )

  const loadInvestorList = useCallback(async () => {
    setInvestorListLoading(true)
    setInvestorListError(null)
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
  }, [])

  useEffect(() => {
    loadInvestorList()
  }, [loadInvestorList])

  useEffect(() => {
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
  }, [investorList])

  useEffect(() => {
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
  }, [investorList, docRefreshKey])

  useEffect(() => {
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
  }, [activityRefreshKey])

  const investorNameBySlug = useMemo(() => {
    const map = {}
    investorList.forEach(item => {
      map[item.slug] = item.name || item.slug
    })
    return map
  }, [investorList])

  const pipelineSummary = useMemo(() => {
    const total = investorList.length
    const normalizedStages = STAGES.map(stage => stage.toLowerCase())
    const stageCounts = STAGES.map(stage => {
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

  const upcomingDeadlines = useMemo(() => {
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
          items.push({ slug, label, date: value, days, investorName })
        }
      })
    })
    items.sort((a, b) => {
      if (a.days !== b.days) return a.days - b.days
      return (a.investorName || '').localeCompare(b.investorName || '', 'es', { sensitivity: 'base' })
    })
    return items
  }, [investorDetailsMap, deadlineThreshold, investorNameBySlug])

  const docHealthSummary = useMemo(() => {
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

  const activityDisplayItems = useMemo(() => {
    return activityItems.map((event, index) => {
      const slug = event?.slug || ''
      const investorName = slug ? (investorNameBySlug[slug] || slug) : ''
      let icon = '•'
      let title = event?.message || 'Actividad'
      let detail = ''
      switch(event?.type){
        case 'investor-created':
          icon = '🆕'
          title = 'Nuevo inversionista'
          detail = investorName || event?.slug || ''
          break
        case 'investor-deleted':
          icon = '🗑️'
          title = 'Inversionista eliminado'
          detail = investorName || event?.slug || ''
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

  const handleRefreshDocInventories = () => setDocRefreshKey(value => value + 1)
  const handleRefreshActivity = () => setActivityRefreshKey(value => value + 1)

  const navigateToDocsSection = useCallback((category, slug, target) => {
    const safeCategory = DASHBOARD_DOC_CATEGORIES.includes(category) ? category : DASHBOARD_DOC_CATEGORIES[0]
    const safeSlug = normalizeSlug(slug) || DEFAULT_INVESTOR_ID
    if (typeof window !== 'undefined'){
      const payload = { category: safeCategory, slug: safeSlug, target, ts: Date.now() }
      try{ window.sessionStorage.setItem('adminDocsRedirect', JSON.stringify(payload)) }catch(_error){}
    }
    navigate('/admin')
  }, [navigate])

  return (
    <div className="container">
      <div className="h1">Actualizaciones</div>

      <div className="grid" style={{ marginBottom: 16 }}>
        <div className="card" style={{ gridColumn: 'span 2', minWidth: 280 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Pipeline global</div>
            {investorListLoading && <span className="badge">Actualizando…</span>}
          </div>
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
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Inversionistas activos</div>
            <button
              type="button"
              className="btn secondary"
              onClick={loadInvestorList}
              disabled={investorListLoading}
            >
              {investorListLoading ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
          <div className="kpi" style={{ marginTop: 4 }}>
            <div className="num">{investorListLoading ? '—' : numberFormatter.format(pipelineSummary.total || 0)}</div>
            <div className="label">Total dados de alta</div>
          </div>
          {investorListError && <div className="notice" style={{ marginTop: 12 }}>{investorListError}</div>}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Alertas de fechas próximas</div>
            {investorDetailsLoading && <span className="badge">Cargando…</span>}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Próximos
            <input
              type="number"
              min="0"
              className="input"
              value={deadlineThreshold}
              onChange={handleDeadlineThresholdChange}
              style={{ width: 72 }}
            />
            días
          </label>
          {investorDetailsError && <div className="notice" style={{ marginBottom: 12 }}>{investorDetailsError}</div>}
          {upcomingDeadlines.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {investorDetailsLoading ? 'Cargando fechas…' : 'Sin hitos próximos.'}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
              {upcomingDeadlines.map(item => (
                <li key={`${item.slug}-${item.label}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  <div style={{ fontWeight: 600 }}>{item.investorName}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {item.label}: {shortDateFormatter.format(new Date(item.date))} · {item.days} día{item.days === 1 ? '' : 's'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Faltan documentos</div>
            <button
              type="button"
              className="btn secondary"
              onClick={handleRefreshDocInventories}
              disabled={docHealthLoading}
            >
              {docHealthLoading ? 'Verificando…' : 'Revisar'}
            </button>
          </div>
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
        </div>

        <div className="card" style={{ gridColumn: 'span 2', minWidth: 280 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Actividad reciente</div>
            <button
              type="button"
              className="btn secondary"
              onClick={handleRefreshActivity}
              disabled={activityLoading}
            >
              {activityLoading ? 'Consultando…' : 'Actualizar'}
            </button>
          </div>
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
        </div>
      </div>

      <div className="grid">
        {items.map((u) => (
          <div key={u.date} className="card">
            <div className="h2">{u.title}</div>
            <div style={{color:'#8b8b8b'}}>{u.date}</div>
            <p>{u.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
