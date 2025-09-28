import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './lib/toast'

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <HashRouter>
      <App />
    </HashRouter>
  </ToastProvider>
)
