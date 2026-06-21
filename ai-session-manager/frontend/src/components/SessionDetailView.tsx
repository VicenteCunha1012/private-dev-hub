import { useEffect, useState } from 'react'
import type { SessionDetail } from '../api/sessionsApi'
import { sessionsApi } from '../api/sessionsApi'

interface SessionDetailViewProps {
  sessionId: string
}

export default function SessionDetailView({ sessionId }: SessionDetailViewProps) {
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'turns' | 'mcp'>('overview')

  useEffect(() => {
    setLoading(true)
    setTab('overview')
    sessionsApi.getSessionDetail(sessionId)
      .then(setDetail)
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading session...
      </div>
    )
  }

  if (!detail) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Session not found
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, letterSpacing: -0.3 }}>{detail.title}</h2>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <Stat label="Messages" value={String(detail.messageCount)} />
          <Stat label="Model" value={detail.model ?? 'unknown'} />
          <Stat label="Version" value={detail.version ?? '—'} />
          <Stat label="Project" value={detail.project.split('/').pop() ?? detail.project} />
          <Stat label="Cost" value={`$${detail.estimatedCostUsd.toFixed(3)}`} highlight />
        </div>
      </div>

      {/* Token summary cards */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', gap: 12,
      }}>
        <TokenCard label="Input" tokens={detail.totalInputTokens} color="#6366f1" />
        <TokenCard label="Output" tokens={detail.totalOutputTokens} color="#8b5cf6" />
        <TokenCard label="Cache Read" tokens={detail.totalCacheReadTokens} color="#22c55e" />
        <TokenCard label="Cache Create" tokens={detail.totalCacheCreationTokens} color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {(['overview', 'turns', 'mcp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', fontSize: 12.5, fontWeight: 500,
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            textTransform: 'capitalize',
          }}>
            {t === 'mcp' ? `MCP Tools (${detail.mcpTools.length})` : t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {tab === 'overview' && <OverviewTab detail={detail} />}
        {tab === 'turns' && <TurnsTab detail={detail} />}
        {tab === 'mcp' && <McpTab detail={detail} />}
      </div>
    </div>
  )
}

function OverviewTab({ detail }: { detail: SessionDetail }) {
  const totalTokens = detail.totalInputTokens + detail.totalOutputTokens + detail.totalCacheReadTokens + detail.totalCacheCreationTokens
  const duration = detail.turns.length > 1
    ? (detail.turns[detail.turns.length - 1]?.timestamp ?? 0) - (detail.turns[0]?.timestamp ?? 0)
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
          Summary
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
              {totalTokens.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Total Tokens</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)' }}>
              ${detail.estimatedCostUsd.toFixed(3)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Estimated Cost</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--info)' }}>
              {duration > 0 ? formatDuration(duration) : '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Duration</div>
          </div>
        </div>
      </div>

      {/* Token distribution bar */}
      <div style={{
        padding: '16px 20px', background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 10,
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          Token Distribution
        </h3>
        <div style={{ display: 'flex', height: 20, borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
          {totalTokens > 0 && (
            <>
              <div style={{ width: `${(detail.totalInputTokens / totalTokens) * 100}%`, background: '#6366f1', minWidth: 2 }} title={`Input: ${detail.totalInputTokens.toLocaleString()}`} />
              <div style={{ width: `${(detail.totalOutputTokens / totalTokens) * 100}%`, background: '#8b5cf6', minWidth: 2 }} title={`Output: ${detail.totalOutputTokens.toLocaleString()}`} />
              <div style={{ width: `${(detail.totalCacheReadTokens / totalTokens) * 100}%`, background: '#22c55e', minWidth: 2 }} title={`Cache Read: ${detail.totalCacheReadTokens.toLocaleString()}`} />
              <div style={{ width: `${(detail.totalCacheCreationTokens / totalTokens) * 100}%`, background: '#f59e0b', minWidth: 2 }} title={`Cache Create: ${detail.totalCacheCreationTokens.toLocaleString()}`} />
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#6366f1', marginRight: 4 }} />Input</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#8b5cf6', marginRight: 4 }} />Output</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />Cache Read</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />Cache Create</span>
        </div>
      </div>
    </div>
  )
}

function TurnsTab({ detail }: { detail: SessionDetail }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {detail.turns.map((turn, i) => (
        <div key={i} style={{
          padding: '10px 14px', borderRadius: 8,
          background: turn.role === 'user' ? 'rgba(99,102,241,0.05)' : 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              padding: '1px 6px', borderRadius: 3,
              background: turn.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(139,92,246,0.15)',
              color: turn.role === 'user' ? '#6366f1' : '#8b5cf6',
            }}>
              {turn.role}
            </span>
            {turn.model && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                {turn.model}
              </span>
            )}
            {turn.timestamp && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                {new Date(turn.timestamp).toLocaleTimeString()}
              </span>
            )}
            {(turn.inputTokens > 0 || turn.outputTokens > 0) && (
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                {turn.inputTokens.toLocaleString()}in / {turn.outputTokens.toLocaleString()}out
              </span>
            )}
          </div>
          {turn.preview && (
            <div style={{
              fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {turn.preview}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function McpTab({ detail }: { detail: SessionDetail }) {
  if (detail.mcpTools.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No MCP tools used in this session
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {detail.mcpTools.map(tool => (
        <div key={tool} style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          fontFamily: 'monospace', fontSize: 12,
        }}>
          {tool}
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: highlight ? 'var(--warning)' : 'var(--text)' }}>{value}</span>
    </div>
  )
}

function TokenCard({ label, tokens, color }: { label: string; tokens: number; color: string }) {
  return (
    <div style={{
      flex: 1, padding: '10px 14px', borderRadius: 8,
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: -0.5 }}>{formatTokens(tokens)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
