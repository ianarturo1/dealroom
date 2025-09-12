import React from 'react'

export default function ProgressBar({ stages = [], current = '' }){
  const idx = Math.max(0, stages.findIndex(s => s === current))
  const pct = stages.length ? ((idx+1) / stages.length) * 100 : 0
  return (
    <div>
      <div className="progress" aria-label="avance">
        <div style={{width: pct+'%'}} />
      </div>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:12, color:'#8b8b8b', marginTop:6}}>
        <span>{stages[0]}</span>
        <span>{current}</span>
        <span>{stages[stages.length-1]}</span>
      </div>
    </div>
  )
}
