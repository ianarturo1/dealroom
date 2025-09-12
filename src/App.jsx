import React, { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Projects from './pages/Projects'
import Admin from './pages/Admin'
import Updates from './pages/Updates'
import NotFound from './pages/NotFound'
import { identity } from './lib/identity'
import './styles.css'

export default function App(){
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    identity.init()
    const u = identity.currentUser()
    if (u) setUser(u)
    identity.on('login', user => { setUser(user); navigate('/'); })
    identity.on('logout', () => { setUser(null); navigate('/login'); })
  }, [])

  const roles = (user && user.app_metadata && user.app_metadata.roles) || []

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
            {roles.some(r => ['admin','ri'].includes(r)) && (
              <NavLink to="/admin" className={({isActive}) => isActive ? 'active' : undefined}>Admin</NavLink>
            )}
            {!user && <NavLink to="/login" className={({isActive}) => isActive ? 'active' : undefined}>Acceso</NavLink>}
            {user && <button className="btn secondary" onClick={() => identity.logout()}>Salir</button>}
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/admin" element={<Admin user={user} />} />
          <Route path="/login" element={<div className="container"><p>Usa el botón Acceso arriba.</p></div>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <div className="footer">© Finsolar Dealroom</div>
    </>
  )
}
