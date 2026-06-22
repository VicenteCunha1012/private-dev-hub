import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

export interface Toast {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  action?: { label: string; entryLabel: string }
  duration?: number // ms, default 5000
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'> & { id?: string }) => void
}

const ToastContext = createContext<ToastContextValue>({ toasts: [], addToast: () => {} })

export function useToasts() {
  return useContext(ToastContext)
}

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 5000

const COLORS: Record<Toast['type'], { bg: string; border: string; icon: string }> = {
  info:    { bg: '#1e3a5f', border: '#2563eb', icon: 'ℹ️' },
  success: { bg: '#14532d', border: '#22c55e', icon: '✅' },
  warning: { bg: '#422006', border: '#f59e0b', icon: '⚠️' },
  error:   { bg: '#450a0a', border: '#ef4444', icon: '❌' },
}

export function ToastProvider({
  children,
  onAction,
}: {
  children: ReactNode
  onAction?: (entryLabel: string) => void
}) {
  const [toasts, setToasts] = useState<(Toast & { removing?: boolean })[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    // Start fade-out
    setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      const timer = timersRef.current.get(id)
      if (timer) {
        clearTimeout(timer)
        timersRef.current.delete(id)
      }
    }, 300)
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
    const id = toast.id || crypto.randomUUID()
    const duration = toast.duration ?? DEFAULT_DURATION

    setToasts(prev => {
      // Deduplicate by id
      const without = prev.filter(t => t.id !== id)
      const next = [{ ...toast, id } as Toast & { removing?: boolean }, ...without]
      // If over max, remove oldest
      if (next.length > MAX_VISIBLE) {
        const removed = next.splice(MAX_VISIBLE)
        removed.forEach(t => {
          const timer = timersRef.current.get(t.id)
          if (timer) { clearTimeout(timer); timersRef.current.delete(t.id) }
        })
      }
      return next
    })

    // Auto-dismiss
    if (duration > 0) {
      const timer = setTimeout(() => removeToast(id), duration)
      const old = timersRef.current.get(id)
      if (old) clearTimeout(old)
      timersRef.current.set(id, timer)
    }
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}
      <div style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 380,
      }}>
        {toasts.map(toast => {
          const colors = COLORS[toast.type]
          return (
            <div
              key={toast.id}
              style={{
                pointerEvents: 'auto',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: '10px 14px',
                color: '#e5e7eb',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                opacity: toast.removing ? 0 : 1,
                transform: toast.removing ? 'translateX(40px)' : 'translateX(0)',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                animation: 'toast-slide-in 0.3s ease',
              }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{colors.icon}</span>
              <span style={{ flex: 1 }}>{toast.message}</span>
              {toast.action && (
                <button
                  onClick={() => onAction?.(toast.action!.entryLabel)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 5,
                    color: '#e5e7eb',
                    padding: '3px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
              >
                x
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toast-slide-in {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
