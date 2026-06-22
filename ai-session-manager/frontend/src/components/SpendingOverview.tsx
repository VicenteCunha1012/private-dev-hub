import { useEffect, useState } from 'react'
import type { SpendingReport } from '../api/sessionsApi'
import { sessionsApi } from '../api/sessionsApi'

export default function SpendingOverview({ tool }: { tool: string }) {
  const [spending, setSpending] = useState<SpendingReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSpending(null)
    sessionsApi.getSpending(tool)
      .then(setSpending)
      .catch(e => setError(e.message))
  }, [tool])

  if (error) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(239,68,68,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Cannot connect</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!spending) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading spending data...
      </div>
    )
  }

  const sortedProjects = Object.entries(spending.byProject).sort(([, a], [, b]) => b - a)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '50px 40px', overflowY: 'auto',
      background: 'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(139,92,246,0.08) 0%, transparent 70%)',
    }}>
      {/* Logo */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 4px 24px rgba(139,92,246,0.4)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2a10 10 0 110 20 10 10 0 010-20z" />
          <path d="M12 8v4l3 3" />
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>AI Session Manager</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>Claude Code usage overview</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, width: '100%', maxWidth: 700, marginBottom: 40 }}>
        <StatCard label="Sessions" value={spending.totalSessions} color="#8b5cf6" />
        <StatCard label="Total Cost" value={`$${spending.estimatedCostUsd.toFixed(2)}`} color="#f59e0b" />
        <StatCard label="Input Tokens" value={formatTokens(spending.totalInputTokens)} color="#6366f1" />
        <StatCard label="Output Tokens" value={formatTokens(spending.totalOutputTokens)} color="#22c55e" />
      </div>

      {/* By model */}
      <div style={{ width: '100%', maxWidth: 700, marginBottom: 30 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
        }}>By Model</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(spending.byModel).sort(([, a], [, b]) => b.estimatedCostUsd - a.estimatedCostUsd).map(([model, data]) => (
            <div key={model} style={{
              padding: '14px 18px', background: 'var(--card-bg)',
              border: '1px solid var(--border)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontWeight: 500, fontSize: 13, fontFamily: 'monospace', flex: 1 }}>{model}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatTokens(data.inputTokens)} in / {formatTokens(data.outputTokens)} out
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--warning)' }}>
                ${data.estimatedCostUsd.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By project */}
      <div style={{ width: '100%', maxWidth: 700 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
        }}>By Project</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedProjects.map(([project, cost]) => {
            const maxCost = sortedProjects[0]?.[1] ?? 1
            return (
              <div key={project} style={{
                padding: '10px 14px', background: 'var(--card-bg)',
                border: '1px solid var(--border)', borderRadius: 8,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${(cost / maxCost) * 100}%`,
                  background: 'rgba(139,92,246,0.06)',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, flex: 1 }}>{project.split('/').pop()}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)' }}>${cost.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      padding: '20px 16px', background: 'var(--card-bg)',
      border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}
