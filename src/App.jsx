import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Projects from './pages/Projects'
import Admin from './pages/Admin'
import Updates from './pages/Updates'
import NotFound from './pages/NotFound'
import './styles.css'

export default function App(){
  return (
    <>
      <header className="header">
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div className="brand">
            <img src="/logo.svg" alt="Finsolar" />
            <span>Dealroom</span>
          </div>
          <nav className="nav">
            <NavLink to="/" end className={({isActive}) => isActive ? 'active' : undefined}>Panel</NavLink>
            <NavLink to="/projects" className={({isActive}) => isActive ? 'active' : undefined}>Proyectos</NavLink>
            <NavLink to="/documents" className={({isActive}) => isActive ? 'active' : undefined}>Documentos</NavLink>
            <NavLink to="/updates" className={({isActive}) => isActive ? 'active' : undefined}>Updates</NavLink>
            <NavLink to="/admin" className={({isActive}) => isActive ? 'active' : undefined}>Admin</NavLink>
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/admin" element={<Admin user={null} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <div className="footer">© Finsolar Dealroom</div>
    </>
  )
}
