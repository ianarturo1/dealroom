import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Documents from './pages/Documents'
import Projects from './pages/Projects'
import Admin from './pages/Admin'
import Updates from './pages/Updates'
import NotFound from './pages/NotFound'
import './styles.css'
import { api } from './lib/api'
import { useInvestorProfile } from './lib/investor'

const DEFAULT_THEME = {
  brand: '#7F4DAB',
  accent: '#F49A00',
  bg: '#F7F7FB',
  text: '#1F2937'
}

function applyThemeVars(themeOverrides){
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const theme = Object.assign({}, DEFAULT_THEME, themeOverrides || {})
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value)
  })
}

export default function App(){
  const location = useLocation()
  const search = location.search
  const { investorId, isInvestorProfile } = useInvestorProfile()
  const [panelTitle, setPanelTitle] = React.useState('Panel')

  React.useEffect(() => {
    if (!investorId) return
    let cancelled = false
    applyThemeVars()
    setPanelTitle('Panel')
    api.getInvestor(investorId)
      .then(data => {
        if (cancelled) return
        const theme = data?.ui?.theme
        if (theme){
          applyThemeVars(theme)
        }
        const title = data?.ui?.panelTitle
        if (title){
          setPanelTitle(title)
        }
      })
      .catch(() => {
        if (!cancelled){
          applyThemeVars()
        }
      })
    return () => {
      cancelled = true
    }
  }, [investorId])

  function withSearch(pathname){
    return { pathname, search }
  }

  return (
    <>
      <header className="header">
        <div className="container" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
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
              {panelTitle}
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
