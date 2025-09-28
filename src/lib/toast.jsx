import React from 'react'

const ToastContext = React.createContext(() => {})

export function ToastProvider({ children }){
  const [toasts, setToasts] = React.useState([])
  const timeoutsRef = React.useRef(new Map())

  const removeToast = React.useCallback((id) => {
    setToasts((items) => items.filter(item => item.id !== id))
    const timeout = timeoutsRef.current.get(id)
    if (timeout){
      clearTimeout(timeout)
      timeoutsRef.current.delete(id)
    }
  }, [])

  const showToast = React.useCallback((message, options = {}) => {
    const { tone = 'info', duration = 4000 } = options
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((items) => [...items, { id, message, tone }])
    if (Number.isFinite(duration) && duration > 0){
      const timeout = setTimeout(() => removeToast(id), duration)
      timeoutsRef.current.set(id, timeout)
    }
    return id
  }, [removeToast])

  React.useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  const value = React.useMemo(() => showToast, [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.tone}`}
            role="alert"
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(){
  return React.useContext(ToastContext)
}
