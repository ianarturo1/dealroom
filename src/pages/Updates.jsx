import React, { useEffect, useState } from 'react'

export default function Updates(){
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch('/data/updates.json').then(r => r.json()).then(setItems).catch(() => setItems([]))
  }, [])
  return (
    <div className="container">
      <div className="h1">Actualizaciones</div>
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
