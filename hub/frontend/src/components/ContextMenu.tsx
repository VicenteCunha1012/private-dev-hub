import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  icon?: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
  onClick: () => void
}

export interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface ContextMenuProps {
  menu: ContextMenuState
  onClose: () => void
}

export default function ContextMenu({ menu, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${menu.x - rect.width}px`
    if (rect.bottom > vh) ref.current.style.top = `${menu.y - rect.height}px`
  }, [menu.x, menu.y])

  return (
    <div ref={ref} style={{
      position: 'fixed', left: menu.x, top: menu.y, zIndex: 9999,
      background: '#1a1730', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8, padding: '4px 0', minWidth: 180,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(12px)',
      animation: 'ctxFadeIn 0.1s ease-out',
    }}>
      {menu.items.map((item, i) => {
        if (item.divider) {
          return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.onClick(); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 12px', fontSize: 12.5, textAlign: 'left',
              color: item.disabled ? '#4a4560' : item.danger ? '#f87171' : '#e2e8f0',
              background: 'transparent', border: 'none', borderRadius: 0,
              cursor: item.disabled ? 'default' : 'pointer',
              transition: 'background 0.08s',
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {item.icon && <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && (
              <span style={{ fontSize: 10, color: '#4a4560', fontFamily: 'monospace' }}>{item.shortcut}</span>
            )}
          </button>
        )
      })}
      <style>{`@keyframes ctxFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
    </div>
  )
}
