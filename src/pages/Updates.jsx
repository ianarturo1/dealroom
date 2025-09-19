import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const STAGES = [
  'Primera reunión',
  'NDA',
  'Entrega de información',
  'Generación de propuesta',
  'Presentación de propuesta',
  'Ajustes técnicos',
  'LOI',
  'Due diligence fiscal/financiero/riesgos',
  'Revisión de contratos',
  'Cronograma de inversión',
  'Firma de contratos'
]

const DASHBOARD_DOC_CATEGORIES = ['NDA', 'Propuestas', 'Contratos']

const normalizeSlug = (value) => (value || '').trim().toLowerCase()

export default function Updates(){
  const navigate = useNavigate()

  const [updates, setUpdates] = useState([])
  const [updatesLoading, setUpdatesLoading] = useState(false)
  const [updatesError, setUpdatesError] = useState(null)

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
    let active = true
    setUpdatesLoading(true)
    setUpdatesError(null)
    fetch('/data/updates.json')
      .then(res => {
        if (!res.ok) throw new Error('Error al cargar actualizaciones')
        return res.json()
      })
      .then(data => {
        if (!active) return
        setUpdates(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!active) return
        setUpdates([])
        setUpdatesError('No se pudieron cargar las novedades.')
      })
      .finally(() => {
        if (active) setUpdatesLoading(false)
      })
    return () => { active = false }
  }, [])

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
            return [item.slug, { __error: error.message || 'Error desconocido' }]
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
              categoryData[investor.slug] = { files: [], error: error.message || 'Error desconocido' }
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
        setActivityItems([])
        setActivityError(error.message)
      })
      .finally(() => {
        if (active) setActivityLoading(false)
      })
    return () => { active = false }
  }, [activityRefreshKey])

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

  const finalStageLabel = STAGES[STAGES.length - 1] || ''
  const pipelineSummary = useMemo(() => {
    if (!investorList.length){
      return { total: 0, counts: [], finalCount: 0, finalPercent: 0 }
    }
    const total = investorList.length
    const stageMap = new Map()
    STAGES.forEach(stage => stageMap.set(stage, 0))
    let known = 0
    investorList.forEach(item => {
      const normalized = (item.status || '').trim().toLowerCase()
      const stage = STAGES.find(candidate => candidate.toLowerCase() === normalized)
      if (stage){
        known += 1
        stageMap.set(stage, (stageMap.get(stage) || 0) + 1)
      }
    })
    const counts = STAGES.map(stage => {
      const count = stageMap.get(stage) || 0
      if (!count) return null
      return {
        stage,
        count,
        percent: total ? (count / total) * 100 : 0
      }
    }).filter(Boolean)
    const othersCount = total - known
    if (othersCount > 0){
      counts.push({ stage: 'Otros', count: othersCount, percent: total ? (othersCount / total) * 100 : 0 })
    }
    const finalNormalized = finalStageLabel.toLowerCase()
    const finalCount = investorList.filter(item => (item.status || '').trim().toLowerCase() === finalNormalized).length
    const finalPercent = total ? (finalCount / total) * 100 : 0
    return { total, counts, finalCount, finalPercent }
  }, [investorList, finalStageLabel])

  const investorNameBySlug = useMemo(() => {
    const map = {}
    investorList.forEach(item => {
      if (item?.slug) map[item.slug] = item.name || item.slug
    })
    Object.entries(investorDetailsMap).forEach(([slug, detail]) => {
      if (detail?.name) map[slug] = detail.name
    })
    return map
  }, [investorList, investorDetailsMap])

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
      const fallbackSlug = missing.length ? missing[0].slug : (investorList[0]?.slug || '')
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

  const handleRefreshDocInventories = useCallback(() => {
    setDocRefreshKey(value => value + 1)
  }, [])

  const handleRefreshActivity = useCallback(() => {
    setActivityRefreshKey(value => value + 1)
  }, [])

  const handleGoToAdmin = useCallback((category, slug, target) => {
    const normalizedCategory = DASHBOARD_DOC_CATEGORIES.includes(category) ? category : DASHBOARD_DOC_CATEGORIES[0]
    const normalizedSlug = normalizeSlug(slug)
    if (typeof window !== 'undefined'){
      try{
        sessionStorage.setItem('adminDocFocus', JSON.stringify({
          category: normalizedCategory,
          slug: normalizedSlug,
          target: target || 'upload',
          ts: Date.now()
        }))
      }catch{}
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
          {investorListError && <div className="notice" style={{ marginTop: 12 }}>{investorListError}</div>}
          <button
            type="button"
            className="btn secondary"
            onClick={loadInvestorList}
            disabled={investorListLoading}
            style={{ marginTop: 12 }}
          >
            {investorListLoading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="h2" style={{ marginTop: 0 }}>Inversionistas activos</div>
          </div>
          <div className="kpi" style={{ marginTop: 4 }}>
            <div className="num">{investorListLoading ? '—' : numberFormatter.format(pipelineSummary.total || 0)}</div>
            <div className="label">Total dados de alta</div>
          </div>
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
              style={{ width: 90, padding: '6px 8px' }}
            />
            días
          </label>
          {upcomingDeadlines.length === 0 && !investorDetailsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sin alertas dentro del rango configurado.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
              {upcomingDeadlines.map(item => {
                const dateValue = item.date ? new Date(item.date) : null
                const formattedDate = dateValue && !Number.isNaN(dateValue.getTime())
                  ? shortDateFormatter.format(dateValue)
                  : item.date
                return (
                  <li key={`${item.slug}-${item.label}`} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                    <div style={{ fontWeight: 600 }}>{item.investorName} · {item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {item.days === 0 ? 'Vence hoy' : `Vence en ${item.days} día${item.days === 1 ? '' : 's'}`} ({formattedDate})
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {investorDetailsError && <div className="notice" style={{ marginTop: 12 }}>{investorDetailsError}</div>}
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
              const disabledFolder = !summary.folderTarget
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
                        onClick={() => handleGoToAdmin(summary.category, summary.fallbackSlug, 'upload')}
                        disabled={!summary.fallbackSlug}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => handleGoToAdmin(summary.category, (summary.folderTarget && summary.folderTarget.slug) || summary.fallbackSlug, 'folder')}
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

      <div style={{ marginTop: 32 }}>
        <div className="h2" style={{ marginTop: 0 }}>Novedades del equipo</div>
        {updatesLoading && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ color: 'var(--muted)' }}>Cargando actualizaciones…</div>
          </div>
        )}
        {updatesError && (
          <div className="card" style={{ marginTop: 12 }}>
            <div className="notice">{updatesError}</div>
          </div>
        )}
        {!updatesLoading && !updatesError && updates.length === 0 && (
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ color: 'var(--muted)' }}>Aún no hay actualizaciones publicadas.</div>
          </div>
        )}
        {updates.length > 0 && (
          <div className="grid" style={{ marginTop: 16 }}>
            {updates.map((u) => (
              <div key={`${u.date}-${u.title}`} className="card">
                <div className="h2">{u.title}</div>
                <div style={{ color: '#8b8b8b' }}>{u.date}</div>
                <p>{u.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
