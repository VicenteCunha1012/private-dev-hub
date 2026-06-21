import type { SessionSummary } from '../api/sessionsApi'

interface SessionListProps {
  sessions: SessionSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearchChange: (s: string) => void
  loading: boolean
  error: string | null
}

export default function SessionList({
  sessions, selectedId, onSelect, search, onSearchChange, loading, error
}: SessionListProps) {
  const filtered = search
    ? sessions.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.project.toLowerCase().includes(search.toLowerCase())
      )
    : sessions

  return (
    <nav style={{
      width: 320, minWidth: 320, background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)', height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(139,92,246,0.4)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2a10 10 0 110 20 10 10 0 010-20z" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', flex: 1 }}>
          AI Sessions
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 14px' }}>
        <input
          type="search"
          placeholder="Search sessions..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          style={{ fontSize: 12.5 }}
        />
      </div>

      <div style={{ padding: '4px 14px 8px' }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Sessions ({filtered.length})
        </span>
      </div>

      {error && (
        <div style={{
          margin: '0 14px 8px', padding: '8px 10px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6, fontSize: 11, color: 'var(--danger)',
        }}>
          {error}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {loading && sessions.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Scanning sessions...
          </div>
        )}

        {filtered.map(session => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '10px 12px',
              borderRadius: 6, marginBottom: 2,
              background: selectedId === session.id ? 'var(--accent-glow)' : undefined,
              borderLeft: selectedId === session.id ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { if (selectedId !== session.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={e => { if (selectedId !== session.id) e.currentTarget.style.background = '' }}
          >
            <div style={{
              fontSize: 12.5, fontWeight: selectedId === session.id ? 500 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 4,
            }}>
              {session.title}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {session.project.split('/').pop()}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {session.messageCount} msgs
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, marginLeft: 'auto',
                color: session.estimatedCostUsd > 1 ? 'var(--warning)' : 'var(--success)',
              }}>
                ${session.estimatedCostUsd.toFixed(2)}
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>
              {new Date(session.lastActivity).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
    </nav>
  )
}
