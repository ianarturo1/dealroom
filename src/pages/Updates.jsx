import React, { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { api } from '@/lib/api'
import { useInvestorProfile } from '@/lib/investor'

const TYPE_LABELS = {
  doc_upload: 'Documento subido',
  doc_delete: 'Documento eliminado',
  doc_update: 'Documento actualizado',
  deadlines_update: 'Actualización de deadlines',
  status_change: 'Cambio de estatus',
  investor_created: 'Alta de inversionista',
  investor_update: 'Actualización de datos'
}

function typeLabel(type){
  return TYPE_LABELS[type] || 'Actualización'
}

export default function Updates(){
  const { investorId } = useInvestorProfile()
  const slug = investorId || ''
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }),
    []
  )
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit' }),
    []
  )

  useEffect(() => {
    let cancelled = false
    if (!slug){
      setItems([])
      setError('No se ha definido un inversionista activo.')
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError(null)

    api.listUpdates({ slug, limit: 50 })
      .then((response) => {
        if (cancelled) return
        const events = Array.isArray(response?.items) ? response.items : []
        const filtered = events.filter((item) => item && item.slug === slug)
        filtered.sort((a, b) => String(b.ts || '').localeCompare(String(a.ts || '')))
        setItems(filtered)
      })
      .catch((err) => {
        if (cancelled) return
        const message = err?.message || 'No se pudieron cargar las actualizaciones.'
        setError(message)
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  const groupedItems = useMemo(() => {
    if (!items.length) return []
    const groups = []
    const dayMap = new Map()
    items.forEach((item) => {
      const date = item?.ts ? new Date(item.ts) : null
      if (!date || Number.isNaN(date.getTime())) return
      const key = date.toISOString().slice(0, 10)
      if (!dayMap.has(key)){
        dayMap.set(key, {
          key,
          label: dateFormatter.format(date),
          items: []
        })
        groups.push(dayMap.get(key))
      }
      dayMap.get(key).items.push(item)
    })
    return groups
  }, [items, dateFormatter])

  if (loading){
    return (
      <div className="container" style={{ maxWidth: 900 }}>
        <div className="h1" style={{ marginBottom: 8 }}>Actualizaciones</div>
        <Card>Cargando actualizaciones…</Card>
      </div>
    )
  }

  return (
    <div className="container" style={{ maxWidth: 900, display: 'grid', gap: 16 }}>
      <div>
        <div className="h1" style={{ marginBottom: 4 }}>Actualizaciones</div>
        {slug ? (
          <p className="help" style={{ margin: 0 }}>
            Movimientos recientes para <strong>{slug}</strong>.
          </p>
        ) : (
          <p className="help" style={{ margin: 0 }}>
            Selecciona un inversionista para ver su actividad.
          </p>
        )}
      </div>

      {error && (
        <div className="notice">{error}</div>
      )}

      {!error && !groupedItems.length && (
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 18 }}>Sin movimientos recientes</div>
          <div className="help" style={{ marginTop: 4 }}>
            No hay actualizaciones registradas para <strong>{slug}</strong> en las últimas commits.
          </div>
        </Card>
      )}

      {groupedItems.map((group) => (
        <section key={group.key} style={{ display: 'grid', gap: 12 }}>
          <h2 className="h2" style={{ marginBottom: 0 }}>{group.label}</h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {group.items.map((item) => (
              <Card key={item.id}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span className="badge" style={{ background: '#f1e8fb', color: 'var(--purple)' }}>
                      {typeLabel(item.type)}
                    </span>
                    <span className="help" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.repo}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Raleway, sans-serif', fontWeight: 700, fontSize: 18 }}>
                    {item.title || typeLabel(item.type)}
                  </div>
                  {item.path ? (
                    <div className="help" style={{ fontFamily: 'Lato, sans-serif' }}>
                      {item.path}
                    </div>
                  ) : null}
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                  <div className="help">{item.actor || 'Desconocido'}</div>
                  <div className="help">
                    {(() => {
                      const date = item?.ts ? new Date(item.ts) : null
                      if (!date || Number.isNaN(date.getTime())) return 'Fecha desconocida'
                      return timeFormatter.format(date)
                    })()}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
