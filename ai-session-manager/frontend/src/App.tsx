import { useCallback, useEffect, useState } from 'react'
import type { SessionSummary } from './api/sessionsApi'
import { sessionsApi } from './api/sessionsApi'
import SessionDetailView from './components/SessionDetailView'
import SessionList from './components/SessionList'
import SpendingOverview from './components/SpendingOverview'

export default function App() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sessionsApi.getSessions()
      setSessions(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

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
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId ? (
          <SessionDetailView key={selectedId} sessionId={selectedId} />
        ) : (
          <SpendingOverview />
        )}
      </main>
    </div>
  )
}
