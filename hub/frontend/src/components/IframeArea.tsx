import { useEffect, useRef, useState } from 'react'
import type { Entry } from '../types'

const CACHE_BUST = `_cb=${Date.now()}`

function normalizeUrl(url: string): string {
  if (!/^https?:\/\//i.test(url)) return 'https://' + url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + CACHE_BUST
}

function isLocalHttps(url: string): boolean {
  try {
    const u = new URL(normalizeUrl(url))
    return u.protocol === 'https:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  } catch { return false }
}

export type LayoutType = 'single' | 'hsplit' | 'quad'

export interface Layout {
  type: LayoutType
  panes: (number | null)[]
}

interface IframeAreaProps {
  entries: Entry[]
  layout: Layout
  reloadKey: number
  onLayoutChange: (layout: Layout) => void
  onDropEntry: (entryId: number, zone: DropZone) => void
  onFocusPane: (idx: number) => void
}

export type DropZone = 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | `replace-${number}`

export default function IframeArea({ entries, layout, reloadKey, onLayoutChange, onDropEntry, onFocusPane }: IframeAreaProps) {
  const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map())
  const [dragOver, setDragOver] = useState<DropZone | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('text/entry-id')) {
        dragCounter.current++
        setDragging(true)
      }
    }
    const onLeave = () => {
      dragCounter.current--
      if (dragCounter.current <= 0) { dragCounter.current = 0; setDragging(false); setDragOver(null) }
    }
    const onEnd = () => { dragCounter.current = 0; setDragging(false) }
    document.addEventListener('dragenter', onEnter)
    document.addEventListener('dragleave', onLeave)
    document.addEventListener('drop', onEnd)
    document.addEventListener('dragend', onEnd)
    return () => {
      document.removeEventListener('dragenter', onEnter)
      document.removeEventListener('dragleave', onLeave)
      document.removeEventListener('drop', onEnd)
      document.removeEventListener('dragend', onEnd)
    }
  }, [])

  // Detect which pane gets focus when user clicks an iframe
  useEffect(() => {
    const onBlur = () => {
      setTimeout(() => {
        const active = document.activeElement
        if (active?.tagName === 'IFRAME') {
          const el = active as HTMLIFrameElement
          for (const [id, ref] of iframeRefs.current) {
            if (ref === el) {
              const idx = layout.panes.indexOf(id)
              if (idx >= 0) onFocusPane(idx)
              break
            }
          }
        }
      }, 0)
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [layout.panes, onFocusPane])

  useEffect(() => {
    if (reloadKey === 0) return
    if (layout.type === 'single' && layout.panes[0] != null) {
      const id = layout.panes[0]
      const iframe = iframeRefs.current.get(id)
      const entry = entries.find(e => e.id === id)
      if (iframe && entry?.url) iframe.src = normalizeUrl(entry.url)
    }
  }, [reloadKey])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    if (layout.type !== 'single') {
      // In split/quad, detect which pane cursor is over → replace it
      const paneIdx = layout.type === 'hsplit'
        ? (x < 0.5 ? 0 : 1)
        : (y < 0.5 ? (x < 0.5 ? 0 : 1) : (x < 0.5 ? 2 : 3))
      // Edge detection: only use split/quad zones at the very edges of the whole area
      const atEdge = x < 0.08 || x > 0.92 || y < 0.08 || y > 0.92
      if (!atEdge) {
        setDragOver(`replace-${paneIdx}`)
        return
      }
    }

    const inCorner = (x < 0.3 || x > 0.7) && (y < 0.3 || y > 0.7)
    if (inCorner) {
      setDragOver(y < 0.5 ? (x < 0.5 ? 'top-left' : 'top-right') : (x < 0.5 ? 'bottom-left' : 'bottom-right'))
    } else {
      setDragOver(x < 0.5 ? 'left' : 'right')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const entryId = parseInt(e.dataTransfer.getData('text/entry-id'), 10)
    if (!isNaN(entryId) && dragOver) onDropEntry(entryId, dragOver)
    setDragOver(null)
  }

  const closePane = (idx: number) => {
    const remaining = layout.panes.filter((_, i) => i !== idx).filter(p => p !== null)
    if (remaining.length <= 1) {
      onLayoutChange({ type: 'single', panes: [remaining[0] ?? null] })
    } else if (remaining.length === 2) {
      onLayoutChange({ type: 'hsplit', panes: remaining })
    } else {
      onLayoutChange({ type: 'quad', panes: [...remaining, null].slice(0, 4) })
    }
  }

  // Compute position rects for each pane based on layout
  const paneRects = computePaneRects(layout)
  const visibleIds = new Set(layout.panes.filter(p => p !== null) as number[])
  const iframeEntries = entries.filter(e => e.url)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Focus reclaim strip */}
      <div
        tabIndex={0}
        onMouseEnter={e => (e.currentTarget as HTMLElement).focus()}
        style={{ position: 'absolute', left: 0, top: 0, width: 6, height: '100%', zIndex: 10, cursor: 'default', outline: 'none' }}
      />

      {/* Drag capture overlay */}
      {dragging && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDrop}
          style={{ position: 'absolute', inset: 0, zIndex: 15, background: 'transparent' }}
        />
      )}

      {/* Drop zone overlay */}
      {dragOver && <DropOverlay zone={dragOver} layout={layout} />}


      {/* Open-in-window button for single pane HTTPS entries */}
      {layout.type === 'single' && layout.panes[0] != null && (() => {
        const entry = entries.find(e => e.id === layout.panes[0])
        if (!entry?.url || !isLocalHttps(entry.url)) return null
        return (
          <button
            title="Open in new window (accept certificate)"
            onClick={() => window.open(normalizeUrl(entry.url!), '_blank', 'width=800,height=600')}
            style={{
              position: 'absolute', top: 6, right: 6, zIndex: 10,
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontFamily: 'monospace',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.3)'; e.currentTarget.style.color = '#c4b5fd' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8' }}
          >
            {'↗'}
          </button>
        )
      })()}

      {/* All iframes — always mounted, positioned by layout */}
      {iframeEntries.map(entry => {
        const paneIdx = layout.panes.indexOf(entry.id)
        const visible = visibleIds.has(entry.id)
        const rect = paneIdx >= 0 ? paneRects[paneIdx] : null

        return (
          <iframe
            key={entry.id}
            ref={el => { if (el) iframeRefs.current.set(entry.id, el); else iframeRefs.current.delete(entry.id) }}
            src={normalizeUrl(entry.url!)}
            title={entry.label}
            style={{
              position: 'absolute',
              left: rect ? rect.left : 0,
              top: rect ? rect.top : 0,
              width: rect ? rect.width : '100%',
              height: rect ? rect.height : '100%',
              border: 'none',
              display: visible ? 'block' : 'none',
            }}
            allow="fullscreen; storage-access; camera; microphone"
            {...(isLocalHttps(entry.url!) ? {} : {
              sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-storage-access-by-user-activation allow-modals'
            })}
          />
        )
      })}

      {/* Pane headers (close buttons) for split modes */}
      {layout.type !== 'single' && layout.panes.map((entryId, idx) => {
        const rect = paneRects[idx]
        if (!rect) return null

        if (entryId === null) {
          return (
            <div key={`empty-${idx}`} style={{
              position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#0d0f17', border: '1px solid rgba(255,255,255,0.06)',
              color: '#475569', fontSize: 12, borderRadius: 4, zIndex: 2,
            }}>
              Drop entry here
            </div>
          )
        }

        const entry = entries.find(e => e.id === entryId)
        return (
          <div key={`header-${idx}`} onMouseDown={() => onFocusPane(idx)} style={{
            position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: 22,
            background: 'linear-gradient(180deg, rgba(13,15,23,0.95) 0%, transparent 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 6px', zIndex: 5,
          }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry?.label}
            </span>
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {entry?.url && isLocalHttps(entry.url) && (
                <button
                  title="Open in new window (accept certificate)"
                  onClick={() => window.open(normalizeUrl(entry.url!), '_blank', 'width=800,height=600')}
                  style={{
                    width: 16, height: 16, borderRadius: 3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: '#64748b', background: 'rgba(255,255,255,0.06)',
                    cursor: 'pointer', flexShrink: 0, fontFamily: 'monospace',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c4b5fd')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
                >
                  {'↗'}
                </button>
              )}
              <button
                onClick={() => closePane(idx)}
                style={{
                  width: 16, height: 16, borderRadius: 3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.06)',
                  cursor: 'pointer', flexShrink: 0,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
              >
                x
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface PaneRect {
  left: string; top: string; width: string; height: string
}

function computePaneRects(layout: Layout): PaneRect[] {
  const gap = 2
  switch (layout.type) {
    case 'hsplit':
      return [
        { left: '0', top: '0', width: `calc(50% - ${gap / 2}px)`, height: '100%' },
        { left: `calc(50% + ${gap / 2}px)`, top: '0', width: `calc(50% - ${gap / 2}px)`, height: '100%' },
      ]
    case 'quad':
      return [
        { left: '0', top: '0', width: `calc(50% - ${gap / 2}px)`, height: `calc(50% - ${gap / 2}px)` },
        { left: `calc(50% + ${gap / 2}px)`, top: '0', width: `calc(50% - ${gap / 2}px)`, height: `calc(50% - ${gap / 2}px)` },
        { left: '0', top: `calc(50% + ${gap / 2}px)`, width: `calc(50% - ${gap / 2}px)`, height: `calc(50% - ${gap / 2}px)` },
        { left: `calc(50% + ${gap / 2}px)`, top: `calc(50% + ${gap / 2}px)`, width: `calc(50% - ${gap / 2}px)`, height: `calc(50% - ${gap / 2}px)` },
      ]
    default:
      return [{ left: '0', top: '0', width: '100%', height: '100%' }]
  }
}

function DropOverlay({ zone, layout }: { zone: DropZone; layout: Layout }) {
  if (zone.startsWith('replace-')) {
    const idx = parseInt(zone.split('-')[1], 10)
    const rects = computePaneRects(layout)
    const rect = rects[idx]
    if (!rect) return null
    return (
      <div style={{
        position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
        zIndex: 20, pointerEvents: 'none',
        background: 'rgba(139,92,246,0.2)', border: '2px solid rgba(139,92,246,0.5)',
        borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ZoneLabel text="Replace" />
      </div>
    )
  }

  const isHalf = zone === 'left' || zone === 'right'

  if (isHalf) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', display: 'flex' }}>
        <div style={{
          flex: 1,
          background: zone === 'left' ? 'rgba(139,92,246,0.15)' : 'transparent',
          borderRight: '2px solid rgba(139,92,246,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {zone === 'left' && <ZoneLabel text="Left" />}
        </div>
        <div style={{
          flex: 1,
          background: zone === 'right' ? 'rgba(139,92,246,0.15)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {zone === 'right' && <ZoneLabel text="Right" />}
        </div>
      </div>
    )
  }

  const quadrants: DropZone[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2,
    }}>
      {quadrants.map(q => (
        <div key={q} style={{
          background: q === zone ? 'rgba(139,92,246,0.15)' : 'transparent',
          border: q === zone ? '2px solid rgba(139,92,246,0.4)' : '1px solid rgba(255,255,255,0.04)',
          borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {q === zone && <ZoneLabel text="2x2" />}
        </div>
      ))}
    </div>
  )
}

function ZoneLabel({ text }: { text: string }) {
  return (
    <span style={{
      padding: '6px 16px', borderRadius: 8,
      background: 'rgba(139,92,246,0.3)', color: '#c4b5fd',
      fontSize: 14, fontWeight: 600, backdropFilter: 'blur(4px)',
    }}>
      {text}
    </span>
  )
}
