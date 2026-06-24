import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { api, ttydApi } from './api/hubApi'
import ConfigPage from './components/ConfigPage'
import HomeScreen from './components/HomeScreen'
import IframeArea, { type DropZone, type Layout } from './components/IframeArea'
import Sidebar from './components/Sidebar'
import Spotlight from './components/Spotlight'
import { ToastProvider, useToasts, type Toast } from './components/ToastContainer'
import { useKeybinds } from './hooks/useKeybinds'
import { applyPalette } from './palettes'
import type { Entry, Folder, KeybindsConfig, PaletteConfig } from './types'
import { DEFAULT_KEYBINDS, DEFAULT_PALETTE } from './types'

declare global {
  interface Window {
    addToast?: (toast: Omit<Toast, 'id'> & { id?: string }) => void
  }
}


export default function App() {
  const handleToastActionRef = useRef<((entryLabel: string) => void) | null>(null)

  return (
    <ToastProvider onAction={(entryLabel) => handleToastActionRef.current?.(entryLabel)}>
      <AppInner onActionRef={handleToastActionRef} />
    </ToastProvider>
  )
}

function AppInner({ onActionRef }: { onActionRef: MutableRefObject<((entryLabel: string) => void) | null> }) {
  const [folders, setFolders] = useState<Folder[]>([])
  const [layout, setLayout] = useState<Layout>({ type: 'single', panes: [null] })
  const [showConfig, setShowConfig] = useState(false)
  const [keybinds, setKeybinds] = useState<KeybindsConfig>(DEFAULT_KEYBINDS)
  const [palette, setPalette] = useState<PaletteConfig>(DEFAULT_PALETTE)
  const [error, setError] = useState<string | null>(null)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [focusedPane, setFocusedPane] = useState(0)
  const [showSpotlight, setShowSpotlight] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const allEntries = useMemo(() => {
    const collect = (folders: Folder[]): Entry[] =>
      folders.flatMap(f => [...f.entries, ...collect(f.children ?? [])])
    return collect(folders)
  }, [folders])
  const selectedEntry = useMemo(() => {
    const firstPane = layout.panes.find(p => p !== null)
    return firstPane != null ? allEntries.find(e => e.id === firstPane) ?? null : null
  }, [layout, allEntries])

  const reconcileTuis = useCallback(async (folders: Folder[], attempt = 0) => {
    const tuiEntries = folders.flatMap(f => f.entries).filter(e => e.type === 'tui')
    if (tuiEntries.length === 0) return
    try {
      const liveSessions = await ttydApi.list()
      const liveUrls = new Set(liveSessions.map(s => s.url))
      for (const entry of tuiEntries) {
        if (entry.url && liveUrls.has(entry.url)) continue
        try {
          const workdir = entry.workdir && entry.workdir !== '/root' ? entry.workdir : '/home/cunvic'
          const cmd = entry.command || 'bash'
          const session = await ttydApi.create(entry.label, workdir, cmd)
          await api.updateEntry(entry.id, { url: session.url })
        } catch { /* individual create failed */ }
      }
    } catch {
      if (attempt < 3) setTimeout(() => reconcileTuis(folders, attempt + 1), 3000)
    }
  }, [])

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders()
      setFolders(data)
      setError(null)
      reconcileTuis(data)
    } catch {
      setError('Backend unreachable — make sure the hub backend is running on port 10303.')
    }
  }, [reconcileTuis])

  useEffect(() => {
    loadFolders()
    api.getConfig()
      .then(c => {
        setKeybinds(c.keybinds ?? DEFAULT_KEYBINDS)
        const p = c.palette ?? DEFAULT_PALETTE
        setPalette(p)
        applyPalette(p)
      })
      .catch(() => {})
  }, [loadFolders])

  // ── Toast system ──────────────────────────────────────────────────────────
  const { addToast } = useToasts()
  const lastToastTimestampRef = useRef(Date.now())

  // Expose addToast globally so iframes/external calls can trigger toasts
  useEffect(() => {
    window.addToast = addToast
    return () => { delete window.addToast }
  }, [addToast])

  // Poll backend for new toasts every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:10303/toasts?since=${lastToastTimestampRef.current}`)
        if (!res.ok) return
        const toasts: { id: string; type: string; message: string; action?: { label: string; entryLabel: string }; timestamp: number }[] = await res.json()
        for (const t of toasts) {
          addToast({
            id: t.id,
            type: t.type as Toast['type'],
            message: t.message,
            action: t.action,
          })
          if (t.timestamp > lastToastTimestampRef.current) {
            lastToastTimestampRef.current = t.timestamp
          }
        }
      } catch { /* backend unreachable, ignore */ }
    }
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [addToast])

  const [reloadKey, setReloadKey] = useState(0)

  const handleSelectEntry = useCallback(async (entry: Entry, reload?: boolean) => {
    if (entry.type === 'tui' && entry.command) {
      try {
        const session = await ttydApi.create(entry.label, entry.workdir || '/home/cunvic', entry.command)
        await api.updateEntry(entry.id, { url: session.url })
      } catch { /* continue with normal select */ }
    }
    setLayout(prev => {
      if (prev.type !== 'single' && prev.panes.some(p => p !== null)) {
        const newPanes = [...prev.panes]
        newPanes[focusedPane] = entry.id
        return { ...prev, panes: newPanes }
      }
      return { type: 'single', panes: [entry.id] }
    })
    setShowConfig(false)
    if (reload) setReloadKey(k => k + 1)
  }, [focusedPane])

  // Wire toast action to navigate to entries
  useEffect(() => {
    onActionRef.current = (entryLabel: string) => {
      const entry = allEntries.find(e => e.label.toLowerCase() === entryLabel.toLowerCase())
      if (entry) handleSelectEntry(entry)
    }
  })

  const handleDropEntry = useCallback(async (entryId: number, zone: DropZone) => {
    const currentPanes = layout.panes.filter(p => p !== null)
    const existing = currentPanes[0]

    // Resolve TUI entry if needed
    const entry = allEntries.find(e => e.id === entryId)
    if (entry?.type === 'tui' && entry.command) {
      try {
        const session = await ttydApi.create(entry.label, entry.workdir || '/home/cunvic', entry.command)
        await api.updateEntry(entry.id, { url: session.url })
      } catch { /* continue anyway */ }
    }

    if (zone.startsWith('replace-')) {
      const idx = parseInt(zone.split('-')[1], 10)
      const newPanes = [...layout.panes]
      newPanes[idx] = entryId
      setLayout({ ...layout, panes: newPanes })
    } else if (zone === 'left' || zone === 'right') {
      const panes = zone === 'left'
        ? [entryId, existing ?? null]
        : [existing ?? null, entryId]
      setLayout({ type: 'hsplit', panes })
    } else {
      const quadMap: Record<string, number> = { 'top-left': 0, 'top-right': 1, 'bottom-left': 2, 'bottom-right': 3 }
      const panes: (number | null)[] = [null, null, null, null]
      currentPanes.forEach((p) => {
        if (p !== null && p !== entryId) {
          const emptyIdx = panes.findIndex(slot => slot === null && slot !== quadMap[zone])
          if (emptyIdx !== -1) panes[emptyIdx] = p
        }
      })
      panes[quadMap[zone]] = entryId
      if (existing != null && existing !== entryId && !panes.includes(existing)) {
        const opposite = 3 - quadMap[zone]
        panes[opposite] = existing
      }
      setLayout({ type: 'quad', panes })
    }
    setShowConfig(false)
  }, [layout, allEntries])

  const handleConfigClick = useCallback(() => {
    setShowConfig(true)
    setLayout({ type: 'single', panes: [null] })
  }, [])

  const handleMoveEntry = useCallback(async (entryId: number, newFolderId: number | undefined, newPosition: number) => {
    try {
      await api.updateEntry(entryId, { folderId: newFolderId, position: newPosition })
      await loadFolders()
    } catch (e) {
      console.error('Failed to move entry', e)
    }
  }, [loadFolders])

  const focusSidebar = useCallback(() => {
    setTimeout(() => sidebarRef.current?.focus(), 30)
  }, [])

  const keybindHandlers = useMemo(() => ({
    goHome: () => {
      setLayout({ type: 'single', panes: [null] })
      setShowConfig(false)
      focusSidebar()
    },
    focusSearch: () => {
      setLayout({ type: 'single', panes: [null] })
      setShowConfig(false)
      setTimeout(() => searchRef.current?.focus(), 50)
    },
    navUp: () => {
      setShowConfig(false)
      setLayout(prev => {
        const currentId = prev.panes.find(p => p !== null)
        const current = currentId != null ? allEntries.find(e => e.id === currentId) : null
        if (!current) return { type: 'single', panes: [allEntries[allEntries.length - 1]?.id ?? null] }
        const idx = allEntries.findIndex(e => e.id === current.id)
        return idx > 0 ? { type: 'single', panes: [allEntries[idx - 1].id] } : prev
      })
    },
    navDown: () => {
      setShowConfig(false)
      setLayout(prev => {
        const currentId = prev.panes.find(p => p !== null)
        const current = currentId != null ? allEntries.find(e => e.id === currentId) : null
        if (!current) return { type: 'single', panes: [allEntries[0]?.id ?? null] }
        const idx = allEntries.findIndex(e => e.id === current.id)
        return idx < allEntries.length - 1 ? { type: 'single', panes: [allEntries[idx + 1].id] } : prev
      })
    },
    openSettings: () => handleConfigClick(),
    openEntry: (entry: Entry) => handleSelectEntry(entry),
  }), [allEntries, handleSelectEntry, handleConfigClick, focusSidebar])

  const handleKeyDown = useKeybinds(keybinds, allEntries, keybindHandlers)

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { rootRef.current?.focus() }, [])

  // Shift to open spotlight (suppress when modals/settings are open)
  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (showConfig || showAddEntry || showSpotlight) return
        setShowSpotlight(true)
      }
    }
    window.addEventListener('keyup', onKeyUp, true)
    return () => window.removeEventListener('keyup', onKeyUp, true)
  }, [showConfig, showAddEntry, showSpotlight])

  const postToIframe = useCallback((entryUrl: string, message: Record<string, unknown>) => {
    const send = () => {
      const iframes = document.querySelectorAll('iframe')
      for (const iframe of iframes) {
        const src = iframe.getAttribute('src') || ''
        if (src.startsWith(entryUrl)) {
          iframe.contentWindow?.postMessage(message, '*')
          return true
        }
      }
      return false
    }
    // Retry multiple times to handle React re-render delay
    send()
    setTimeout(send, 100)
    setTimeout(send, 300)
    setTimeout(send, 600)
    setTimeout(send, 1000)
  }, [])

  const handleSpotlightSelect = useCallback((result: { id: string; category: string; data?: unknown }) => {
    setShowSpotlight(false)
    if (result.id.startsWith('entry-')) {
      const entry = result.data as Entry
      handleSelectEntry(entry)
    } else if (result.id.startsWith('topic-')) {
      const kafbat = allEntries.find(e => e.label.toLowerCase().includes('kafbat'))
      if (kafbat) {
        handleSelectEntry(kafbat)
        const topicName = (result.data as { name: string }).name
        postToIframe(kafbat.url!, { type: 'spotlight-navigate', action: 'open-topic', value: topicName })
      }
    } else if (result.id.startsWith('json-')) {
      const jsonTools = allEntries.find(e => e.label.toLowerCase().includes('json'))
      if (jsonTools) {
        handleSelectEntry(jsonTools)
        const tab = result.id.replace('json-', '')
        postToIframe(jsonTools.url!, { type: 'spotlight-navigate', action: 'open-tab', value: tab })
      }
    } else if (result.id.startsWith('cmd-')) {
      const vault = allEntries.find(e => e.label.toLowerCase().includes('command') || e.label.toLowerCase().includes('vault'))
      if (vault) {
        handleSelectEntry(vault)
        const cmdId = (result.data as { id: number }).id
        postToIframe(vault.url!, { type: 'spotlight-navigate', action: 'open-command', value: cmdId })
      }
    } else if (result.id.startsWith('spec-')) {
      const mock = allEntries.find(e => e.label.toLowerCase().includes('mock'))
      if (mock) handleSelectEntry(mock)
    }
  }, [allEntries, handleSelectEntry])

  const hasIframe = layout.panes.some(p => p !== null)
  const showIframe = hasIframe && !showConfig
  const showHome = !showConfig && !hasIframe

  return (
    <div ref={rootRef} tabIndex={-1} onKeyDown={handleKeyDown} style={{ display: 'flex', height: '100%', width: '100%', outline: 'none' }}>
      <Sidebar
        ref={sidebarRef}
        folders={folders}
        selectedId={selectedEntry?.id ?? null}
        showConfig={showConfig}
        keybinds={keybinds}
        onSelect={handleSelectEntry}
        onConfigClick={handleConfigClick}
        onGoHome={() => { setLayout({ type: 'single', panes: [null] }); setShowConfig(false) }}
        onAddEntry={() => setShowAddEntry(true)}
        onMoveEntry={handleMoveEntry}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {error && (
          <div style={{
            padding: '10px 18px', background: '#2a0f0f', borderBottom: '1px solid #5a2020',
            color: '#f87171', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {showHome && (
          <HomeScreen
            folders={folders}
            keybinds={keybinds}
            searchRef={searchRef}
            onSelect={handleSelectEntry}
            onAddEntry={() => setShowAddEntry(true)}
          />
        )}
        {showConfig && (
          <ConfigPage
            folders={folders}
            keybinds={keybinds}
            onKeybindsChange={setKeybinds}
            palette={palette}
            onPaletteChange={p => { setPalette(p); applyPalette(p) }}
            onRefresh={loadFolders}
          />
        )}

        <div style={{
          position: showIframe ? 'relative' : 'absolute',
          inset: 0,
          flex: showIframe ? 1 : undefined,
          display: showIframe ? 'flex' : 'none',
          flexDirection: 'column',
        }}>
          <IframeArea
            entries={allEntries}
            layout={layout}
            reloadKey={reloadKey}
            onLayoutChange={setLayout}
            onDropEntry={handleDropEntry}
            onFocusPane={setFocusedPane}
          />
        </div>
      </main>

      {showAddEntry && (
        <AddEntryModal
          folders={folders}
          onClose={() => setShowAddEntry(false)}
          onSaved={() => { setShowAddEntry(false); loadFolders() }}
        />
      )}

      {showSpotlight && (
        <Spotlight
          entries={allEntries}
          onSelect={handleSpotlightSelect}
          onClose={() => setShowSpotlight(false)}
        />
      )}

    </div>
  )
}

function AddEntryModal({ folders, onClose, onSaved }: { folders: Folder[]; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [type, setType] = useState<'redirect' | 'tui'>('redirect')
  const [folderId, setFolderId] = useState<number | undefined>(folders[0]?.id)
  const [workdir, setWorkdir] = useState('')
  const [command, setCommand] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!label.trim()) return
    setSaving(true)
    setError(null)
    try {
      if (type === 'tui') {
        const session = await ttydApi.create(label, workdir || '/home/cunvic', command)
        await api.createEntry({ label, url: session.url, type, folderId, position: 0, workdir: workdir || '/home/cunvic', command })
      } else {
        await api.createEntry({ label, url: url || undefined, type, folderId, position: 0 })
      }
      onSaved()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 24, width: 440,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Add Entry</h2>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--text-muted)' }}>x</button>
        </div>
        {error && (
          <div style={{ padding: '8px 12px', background: '#2a0f0f', border: '1px solid #5a2020', borderRadius: 6, color: '#f87171', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); save() }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="My Service" autoFocus required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value as typeof type)}>
                <option value="redirect">Redirect (URL)</option>
                <option value="tui">TUI (terminal)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Folder</label>
              <select value={folderId ?? ''} onChange={e => setFolderId(e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          {type === 'redirect' ? (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Command</label>
                <input value={command} onChange={e => setCommand(e.target.value)} placeholder="lazydocker" required />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Working directory</label>
                <input value={workdir} onChange={e => setWorkdir(e.target.value)} placeholder="/home/cunvic" />
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{
              padding: '7px 16px', border: '1px solid var(--border)', borderRadius: 7,
              color: 'var(--text)', fontSize: 13,
            }}>Cancel</button>
            <button type="submit" disabled={saving} style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
              background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-2))',
              color: '#fff', opacity: saving ? 0.6 : 1,
            }}>{saving ? 'Adding...' : 'Add entry'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
