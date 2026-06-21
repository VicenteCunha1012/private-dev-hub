import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ttydApi } from './api/hubApi'
import ConfigPage from './components/ConfigPage'
import HomeScreen from './components/HomeScreen'
import IframeArea from './components/IframeArea'
import Sidebar from './components/Sidebar'
import { useKeybinds } from './hooks/useKeybinds'
import { applyPalette } from './palettes'
import type { Entry, Folder, KeybindsConfig, PaletteConfig } from './types'
import { DEFAULT_KEYBINDS, DEFAULT_PALETTE } from './types'

export default function App() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [keybinds, setKeybinds] = useState<KeybindsConfig>(DEFAULT_KEYBINDS)
  const [palette, setPalette] = useState<PaletteConfig>(DEFAULT_PALETTE)
  const [error, setError] = useState<string | null>(null)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const allEntries = useMemo(() => folders.flatMap(f => f.entries), [folders])

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

  const [reloadKey, setReloadKey] = useState(0)

  const handleSelectEntry = useCallback(async (entry: Entry, reload?: boolean) => {
    if (entry.type === 'tui' && entry.command) {
      try {
        const session = await ttydApi.create(entry.label, entry.workdir || '/root', entry.command)
        const updated = { ...entry, url: session.url }
        await api.updateEntry(entry.id, { url: session.url })
        setSelectedEntry(updated)
        setShowConfig(false)
        setReloadKey(k => k + 1)
        return
      } catch { /* fall through to normal select */ }
    }
    setSelectedEntry(entry)
    setShowConfig(false)
    if (reload) setReloadKey(k => k + 1)
  }, [])

  const handleConfigClick = useCallback(() => {
    setShowConfig(true)
    setSelectedEntry(null)
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
      setSelectedEntry(null)
      setShowConfig(false)
      focusSidebar()
    },
    focusSearch: () => {
      setSelectedEntry(null)
      setShowConfig(false)
      setTimeout(() => searchRef.current?.focus(), 50)
    },
    navUp: () => {
      setShowConfig(false)
      setSelectedEntry(prev => {
        if (!prev) return allEntries[allEntries.length - 1] ?? null
        const idx = allEntries.findIndex(e => e.id === prev.id)
        return idx > 0 ? allEntries[idx - 1] : prev
      })
    },
    navDown: () => {
      setShowConfig(false)
      setSelectedEntry(prev => {
        if (!prev) return allEntries[0] ?? null
        const idx = allEntries.findIndex(e => e.id === prev.id)
        return idx < allEntries.length - 1 ? allEntries[idx + 1] : prev
      })
    },
    openSettings: () => handleConfigClick(),
    openEntry: (entry: Entry) => handleSelectEntry(entry),
  }), [allEntries, handleSelectEntry, handleConfigClick, focusSidebar])

  const handleKeyDown = useKeybinds(keybinds, allEntries, keybindHandlers)

  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { rootRef.current?.focus() }, [])


  const showIframe = selectedEntry !== null && !showConfig
  const showHome = !showConfig && selectedEntry === null

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
        onGoHome={() => { setSelectedEntry(null); setShowConfig(false) }}
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
          <IframeArea entries={allEntries} selectedId={selectedEntry?.id ?? null} reloadKey={reloadKey} />
        </div>
      </main>

      {showAddEntry && (
        <AddEntryModal
          folders={folders}
          onClose={() => setShowAddEntry(false)}
          onSaved={() => { setShowAddEntry(false); loadFolders() }}
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
        const session = await ttydApi.create(label, workdir || '/root', command)
        await api.createEntry({ label, url: session.url, type, folderId, position: 0, workdir: workdir || '/root', command })
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
                <input value={workdir} onChange={e => setWorkdir(e.target.value)} placeholder="/root" />
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
