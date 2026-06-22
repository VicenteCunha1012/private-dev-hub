import { useState, type RefObject } from 'react'
import type { ClusterConfig, TopicInfo } from '../api/kafkaApi'

interface TopicListProps {
  topics: TopicInfo[]
  selectedTopic: string | null
  onSelect: (name: string) => void
  loading: boolean
  error: string | null
  onRefresh: () => void
  onCreateTopic: () => void
  clusters: ClusterConfig[]
  selectedClusterId: number | null
  onClusterChange: (id: number) => void
  searchRef?: RefObject<HTMLInputElement | null>
}

export default function TopicList({
  topics, selectedTopic, onSelect, loading, error, onRefresh, onCreateTopic,
  clusters, selectedClusterId, onClusterChange, searchRef,
}: TopicListProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? topics.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : topics

  return (
    <nav style={{
      width: 280, minWidth: 280,
      background: 'var(--sidebar-bg)',
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 14px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', letterSpacing: -0.2, flex: 1 }}>
          Kafbat+
        </span>
        <button onClick={onRefresh} title="Refresh" style={{
          width: 28, height: 28, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', transition: 'background 0.1s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115.82-5.84L21 8" />
            <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15.82 5.84L3 16" />
          </svg>
          <kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 2, lineHeight: 1.5 }}>r</kbd>
        </button>
      </div>

      {/* Cluster selector */}
      {clusters.length > 0 && (
        <div style={{ padding: '10px 14px 0' }}>
          <div style={{ position: 'relative' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: '#6366f1', pointerEvents: 'none',
            }}>
              <circle cx="12" cy="5" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="5" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
              <circle cx="19" cy="19" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8v4M9 15l-2 2M15 15l2 2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <select
              value={selectedClusterId ?? ''}
              onChange={e => onClusterChange(Number(e.target.value))}
              style={{
                width: '100%', paddingLeft: 30, fontSize: 12,
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 6, color: 'var(--text)',
                height: 32, cursor: 'pointer',
              }}
            >
              {clusters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.isDefault ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 15 15" fill="none" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }}>
            <path d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM13 13l-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search topics..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 12.5 }}
          />
        </div>
      </div>

      {/* Topic count + create */}
      <div style={{
        padding: '4px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Topics ({filtered.length})
        </span>
        <button onClick={onCreateTopic} style={{
          fontSize: 10.5, color: 'var(--accent)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>n</kbd>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          margin: '0 14px 8px', padding: '8px 10px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6, fontSize: 11, color: 'var(--danger)',
        }}>
          {error}
        </div>
      )}

      {/* Topics list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
        {loading && topics.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Loading topics...
          </div>
        )}

        {filtered.map(topic => (
          <button
            key={topic.name}
            onClick={() => onSelect(topic.name)}
            style={{
              width: '100%', textAlign: 'left',
              padding: '8px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              color: selectedTopic === topic.name ? 'var(--text)' : 'var(--text)',
              background: selectedTopic === topic.name ? 'var(--accent-glow)' : undefined,
              borderRadius: 6, fontSize: 12.5,
              borderLeft: selectedTopic === topic.name ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'background 0.1s',
              marginBottom: 1,
            }}
            onMouseEnter={e => { if (selectedTopic !== topic.name) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={e => { if (selectedTopic !== topic.name) e.currentTarget.style.background = '' }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontWeight: selectedTopic === topic.name ? 500 : 400,
              }}>
                {topic.name}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {topic.partitions}p
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {formatCount(topic.messageCount)} msgs
                </span>
              </div>
            </div>
          </button>
        ))}

        {!loading && filtered.length === 0 && topics.length > 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No topics match "{search}"
          </div>
        )}
      </div>
    </nav>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
