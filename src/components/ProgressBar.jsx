import React from 'react'

export default function ProgressBar({ stages = [], current = '' }){
  const idx = Math.max(0, stages.findIndex(s => s === current))
  const pct = stages.length ? ((idx+1) / stages.length) * 100 : 0
  return (
    <div>
      <div className="progress" aria-label="avance">
        <div className="progress-value" style={{width: pct+'%'}} />
      </div>
      <div
        className="progress-legend"
        style={{gridTemplateColumns: stages.length ? `repeat(${stages.length}, minmax(0, 1fr))` : undefined}}
      >
        {stages.map((stageName, i) => (
          <span
            key={stageName + '-' + i}
            className={`progress-stage ${stageName === current ? 'is-active' : ''} ${i === 0 ? 'is-start' : i === stages.length-1 ? 'is-end' : ''}`.trim()}
          >
            {stageName}
          </span>
        ))}
      </div>
    </div>
  )
}
