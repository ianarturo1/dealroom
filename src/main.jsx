import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from '@/App'
import './styles/admin-theme.css'
import { ToastProvider } from '@/lib/toast'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => console.error('GlobalError:', e.error || e.message))
  window.addEventListener('unhandledrejection', (e) => console.error('UnhandledRejection:', e.reason))
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <ToastProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </ToastProvider>
  </ErrorBoundary>
)
