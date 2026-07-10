import { useEffect, useRef } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function Modal({ title, onClose, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div className="card" style={{
        padding: '24px 24px 20px',
        minWidth: 380, maxWidth: 480, width: '90%',
        maxHeight: '80vh', overflowY: 'auto',
        boxShadow: 'var(--sh-lg), 0 0 0 1px color-mix(in srgb, var(--ac) 10%, transparent)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.2 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: 'var(--glass)', border: '1px solid var(--glass-bd)',
              color: 'var(--text-muted)', fontSize: 16, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
