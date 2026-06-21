import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api/hubApi'
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
  const searchRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  const allEntries = useMemo(() => folders.flatMap(f => f.entries), [folders])

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.getFolders()
      setFolders(data)
      setError(null)
    } catch {
      setError('Backend unreachable — make sure the hub backend is running on port 10303.')
    }
  }, [])

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

  const handleSelectEntry = useCallback((entry: Entry) => {
    setSelectedEntry(entry)
    setShowConfig(false)
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

  useKeybinds(keybinds, allEntries, keybindHandlers)

  const showIframe = selectedEntry !== null && !showConfig
  const showHome = !showConfig && selectedEntry === null

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <Sidebar
        ref={sidebarRef}
        folders={folders}
        selectedId={selectedEntry?.id ?? null}
        showConfig={showConfig}
        keybinds={keybinds}
        onSelect={handleSelectEntry}
        onConfigClick={handleConfigClick}
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
          <IframeArea entries={allEntries} selectedId={selectedEntry?.id ?? null} />
        </div>
      </main>
    </div>
  )
}
