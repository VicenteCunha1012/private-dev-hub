import { useEffect, useRef } from 'react'
import type { Entry } from '../types'

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return 'https://' + url
}

function isLocalHttps(url: string): boolean {
  try {
    const u = new URL(normalizeUrl(url))
    return u.protocol === 'https:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
  } catch { return false }
}

interface IframeAreaProps {
  entries: Entry[]
  selectedId: number | null
  reloadKey: number
}

export default function IframeArea({ entries, selectedId, reloadKey }: IframeAreaProps) {
  const iframeEntries = entries.filter(e => e.url)
  const iframeRefs = useRef<Map<number, HTMLIFrameElement>>(new Map())

  useEffect(() => {
    if (selectedId == null || reloadKey === 0) return
    const iframe = iframeRefs.current.get(selectedId)
    if (iframe) {
      const entry = entries.find(e => e.id === selectedId)
      if (entry?.url) iframe.src = normalizeUrl(entry.url)
    }
  }, [reloadKey, selectedId, entries])

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* Focus reclaim strip on left edge — hover here to regain keybinds from iframe */}
      <div
        tabIndex={0}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).focus(); }}
        style={{
          position: 'absolute', left: 0, top: 0, width: 6, height: '100%',
          zIndex: 10, cursor: 'default', outline: 'none',
        }}
      />
      {iframeEntries.map(entry => (
        <iframe
          key={entry.id}
          ref={el => { if (el) iframeRefs.current.set(entry.id, el); else iframeRefs.current.delete(entry.id); }}
          src={normalizeUrl(entry.url!)}
          title={entry.label}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            border: 'none',
            display: selectedId === entry.id ? 'block' : 'none',
          }}
          allow="fullscreen; storage-access; camera; microphone"
          {...(isLocalHttps(entry.url!) ? {} : {
            sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-storage-access-by-user-activation'
          })}
        />
      ))}
    </div>
  )
}
