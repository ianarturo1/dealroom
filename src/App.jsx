import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Projects from './pages/Projects'
import Admin from './pages/Admin'
import Updates from './pages/Updates'
import NotFound from './pages/NotFound'
import './styles.css'
import { useInvestorProfile } from './lib/investor'

export default function App(){
  const location = useLocation()
  const search = location.search
  const { isInvestorProfile } = useInvestorProfile()

  function withSearch(pathname){
    return { pathname, search }
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <img src="/logo.svg" alt="Finsolar" />
            <span>Dealroom</span>
          </div>
          <nav className="nav">
            <NavLink
              to={withSearch('/')}
              end
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Panel
            </NavLink>
            <NavLink
              to={withSearch('/projects')}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Proyectos
            </NavLink>
            <NavLink
              to={withSearch('/documents')}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Documentos
            </NavLink>
            <NavLink
              to={withSearch('/updates')}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Updates
            </NavLink>
            {!isInvestorProfile && (
              <NavLink
                to={withSearch('/admin')}
                className={({ isActive }) => (isActive ? 'active' : undefined)}
              >
                Admin
              </NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/updates" element={<Updates />} />
          {!isInvestorProfile && <Route path="/admin" element={<Admin user={null} />} />}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <div className="footer">© Finsolar Dealroom</div>
    </>
  )
}
