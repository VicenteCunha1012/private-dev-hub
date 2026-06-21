import { useEffect, useState } from 'react'
import type { SpendingProjection, SpendingTimeline } from '../api/sessionsApi'
import { sessionsApi } from '../api/sessionsApi'

export default function CostTracker() {
  const [timeline, setTimeline] = useState<SpendingTimeline | null>(null)
  const [projection, setProjection] = useState<SpendingProjection | null>(null)
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')

  useEffect(() => {
    sessionsApi.getTimeline('claude-code', period).then(setTimeline).catch(() => {})
    sessionsApi.getProjection('claude-code').then(setProjection).catch(() => {})
  }, [period])

  if (!timeline || !projection) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading cost data...</div>
  }

  const maxCost = Math.max(...timeline.points.map(p => p.costUsd), 0.01)

  return (
    <div style={{ padding: '20px 24px', overflowY: 'auto', height: '100%' }}>
      {/* Projection cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <ProjCard label="Total Spent" value={`$${projection.totalCostUsd.toFixed(2)}`} color="#8b5cf6" />
        <ProjCard label="Daily Average" value={`$${projection.dailyAvgCostUsd.toFixed(2)}`} color="#6366f1" />
        <ProjCard label="Monthly Projection" value={`$${projection.projectedMonthlyCostUsd.toFixed(2)}`} color="#f59e0b" />
        <ProjCard label="Days of Data" value={String(projection.daysOfData)} color="#22c55e" />
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Spending Timeline
        </h3>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: 2 }}>
          {(['daily', 'weekly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '5px 14px', fontSize: 11, fontWeight: 500,
              borderRadius: 4, textTransform: 'capitalize',
              color: period === p ? '#fff' : 'var(--text-muted)',
              background: period === p ? 'var(--accent)' : 'transparent',
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Bar chart */}
      {timeline.points.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No spending data available
        </div>
      ) : (
        <div style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 200 }}>
            {timeline.points.map(point => {
              const height = Math.max((point.costUsd / maxCost) * 180, 2)
              return (
                <div key={point.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }} title={`${point.date}: $${point.costUsd.toFixed(3)} (${point.sessions} sessions)`}>
                  <span style={{ fontSize: 9, color: 'var(--text-dim)', marginBottom: 4, whiteSpace: 'nowrap' }}>
                    ${point.costUsd.toFixed(2)}
                  </span>
                  <div style={{
                    width: '100%', maxWidth: 32, height, borderRadius: '4px 4px 0 0',
                    background: 'linear-gradient(to top, #6366f1, #8b5cf6)',
                    transition: 'height 0.3s',
                  }} />
                </div>
              )
            })}
          </div>
          <div style={{
            display: 'flex', gap: 3, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 6,
          }}>
            {timeline.points.map(point => (
              <div key={point.date} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
                <span style={{
                  fontSize: 8, color: 'var(--text-dim)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'block',
                }}>
                  {point.date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail table */}
      {timeline.points.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            Detail
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Cost', 'Sessions', 'Input Tokens', 'Output Tokens'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 10px', fontWeight: 600,
                    color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...timeline.points].reverse().map(p => (
                <tr key={p.date} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{p.date}</td>
                  <td style={{ padding: '8px 10px', fontWeight: 600, color: p.costUsd > 1 ? 'var(--warning)' : 'var(--success)' }}>
                    ${p.costUsd.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px 10px' }}>{p.sessions}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.inputTokens.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{p.outputTokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ProjCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '18px 16px', background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 10, textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}
