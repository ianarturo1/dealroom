import React from 'react'

export default function ProgressBar({ stages = [], current = '' }){
  const idx = Math.max(0, stages.findIndex(s => s === current))
  const pct = stages.length ? ((idx+1) / stages.length) * 100 : 0
  return (
    <div>
      <div className="progress" aria-label="avance">
        <div style={{width: pct+'%'}} />
      </div>
      <div
        style={{
          display:'grid',
          gridTemplateColumns: stages.length ? `repeat(${stages.length}, minmax(0, 1fr))` : undefined,
          fontSize:12,
          color:'#8b8b8b',
          marginTop:6,
          columnGap:8,
          rowGap:4
        }}
      >
        {stages.map((stageName, i) => (
          <span
            key={stageName + '-' + i}
            style={{
              textAlign: i === 0 ? 'left' : i === stages.length-1 ? 'right' : 'center',
              fontWeight: stageName === current ? 700 : 400,
              color: stageName === current ? '#161616' : undefined
            }}
          >
            {stageName}
          </span>
        ))}
      </div>
    </div>
  )
}
