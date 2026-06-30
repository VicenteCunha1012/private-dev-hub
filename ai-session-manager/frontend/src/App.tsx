import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionSummary } from './api/sessionsApi'
import { sessionsApi } from './api/sessionsApi'
import AiConfigView from './components/AiConfigView'
import AiMemoryView from './components/AiMemoryView'
import ApplyConfigView from './components/ApplyConfigView'
import CostTracker from './components/CostTracker'
import SessionDetailView from './components/SessionDetailView'
import SessionList from './components/SessionList'
import SpendingOverview from './components/SpendingOverview'

type HomeTab = 'overview' | 'costs' | 'config' | 'apply' | 'memory'

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [homeTab, setHomeTab] = useState<HomeTab>('overview')
  const [tool, setTool] = useState('claude-code')
  const [modelFilter, setModelFilter] = useState('')

  const searchRef = useRef<HTMLInputElement>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sessionsApi.getSessions(tool)
      setSessions(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [tool])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'f') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') { e.preventDefault(); setSelectedId(null) }
      if (e.key === '1') { e.preventDefault(); setSelectedId(null); setHomeTab('overview') }
      if (e.key === '2') { e.preventDefault(); setSelectedId(null); setHomeTab('costs') }
      if (e.key === '3') { e.preventDefault(); setSelectedId(null); setHomeTab('config') }
      if (e.key === '4') { e.preventDefault(); setSelectedId(null); setHomeTab('apply') }
      if (e.key === '5') { e.preventDefault(); setSelectedId(null); setHomeTab('memory') }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const filtered = sessions
          .filter(s => !modelFilter || s.model === modelFilter)
          .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.project.toLowerCase().includes(search.toLowerCase()))
        const idx = filtered.findIndex(s => s.id === selectedId)
        if (idx < filtered.length - 1) setSelectedId(filtered[idx + 1].id)
        else if (idx === -1 && filtered.length > 0) setSelectedId(filtered[0].id)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const filtered = sessions
          .filter(s => !modelFilter || s.model === modelFilter)
          .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.project.toLowerCase().includes(search.toLowerCase()))
        const idx = filtered.findIndex(s => s.id === selectedId)
        if (idx > 0) setSelectedId(filtered[idx - 1].id)
      }
    }
    document.addEventListener('keydown', handle, true)
    return () => document.removeEventListener('keydown', handle, true)
  }, [sessions, selectedId, search, modelFilter])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <SessionList
        sessions={sessions}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        error={error}
        tool={tool}
        onToolChange={setTool}
        modelFilter={modelFilter}
        onModelFilterChange={setModelFilter}
        searchRef={searchRef}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId ? (
          <SessionDetailView key={selectedId} sessionId={selectedId} />
        ) : (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#161922' }}>
              {(['overview', 'costs', 'config', 'apply', 'memory'] as const).map((t, i) => (
                <button key={t} onClick={() => setHomeTab(t)} style={{
                  padding: '10px 20px', fontSize: 12.5, fontWeight: 500,
                  color: homeTab === t ? '#8b5cf6' : '#64748b',
                  borderBottom: homeTab === t ? '2px solid #8b5cf6' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}>
                  {t === 'costs' ? 'Cost Tracker' : t === 'config' ? 'AI Config' : t === 'apply' ? 'Apply Config' : t === 'memory' ? 'Memory' : 'Overview'}<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>{i + 1}</kbd>
                </button>
              ))}
            </div>
            {homeTab === 'overview' ? <SpendingOverview tool={tool} /> :
             homeTab === 'costs' ? <CostTracker tool={tool} /> :
             homeTab === 'config' ? <AiConfigView /> :
             homeTab === 'memory' ? <AiMemoryView /> :
             <ApplyConfigView />}
          </>
        )}
      </main>
    </div>
  )
}
