import React, { useEffect, useState } from 'react'
import { api } from '../lib/api'
import ProjectCard from '../components/ProjectCard'

export default function Projects(){
  const [items, setItems] = useState([])
  const [err, setErr] = useState(null)
  useEffect(() => {
    api.listProjects().then(setItems).catch(e => setErr(e.message))
  }, [])
  return (
    <div className="container">
      <div className="h1">Proyectos activos</div>
      {err && <div className="notice">{err}</div>}
      <div className="grid">
        {items.map(p => <ProjectCard key={p.id} p={p} />)}
      </div>
    </div>
  )
}
