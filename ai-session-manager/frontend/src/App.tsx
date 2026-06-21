import { useCallback, useEffect, useState } from 'react'
import type { SessionSummary } from './api/sessionsApi'
import { sessionsApi } from './api/sessionsApi'
import CostTracker from './components/CostTracker'
import SessionDetailView from './components/SessionDetailView'
import SessionList from './components/SessionList'
import SpendingOverview from './components/SpendingOverview'

type HomeTab = 'overview' | 'costs'

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [homeTab, setHomeTab] = useState<HomeTab>('overview')
  const [tool, setTool] = useState('claude-code')
  const [modelFilter, setModelFilter] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sessionsApi.getSessions(tool || 'claude-code')
      setSessions(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [tool])

  useEffect(() => { loadSessions() }, [loadSessions])

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
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId ? (
          <SessionDetailView key={selectedId} sessionId={selectedId} />
        ) : (
          <>
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#161922' }}>
              {(['overview', 'costs'] as const).map(t => (
                <button key={t} onClick={() => setHomeTab(t)} style={{
                  padding: '10px 20px', fontSize: 12.5, fontWeight: 500,
                  color: homeTab === t ? '#8b5cf6' : '#64748b',
                  borderBottom: homeTab === t ? '2px solid #8b5cf6' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}>
                  {t === 'costs' ? 'Cost Tracker' : 'Overview'}
                </button>
              ))}
            </div>
            {homeTab === 'overview' ? <SpendingOverview tool={tool} /> : <CostTracker tool={tool} />}
          </>
        )}
      </main>
    </div>
  )
}
