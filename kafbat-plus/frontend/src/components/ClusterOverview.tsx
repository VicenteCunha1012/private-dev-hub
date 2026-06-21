import { useEffect, useState } from 'react'
import type { ClusterOverview as ClusterOverviewType } from '../api/kafkaApi'
import { kafkaApi } from '../api/kafkaApi'

export default function ClusterOverview() {
  const [cluster, setCluster] = useState<ClusterOverviewType | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    kafkaApi.getCluster()
      .then(setCluster)
      .catch(e => setError(e.message))
  }, [])

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
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Cannot connect to Kafka</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
            Check your broker configuration. Make sure Kafka is running and accessible.
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8, fontFamily: 'monospace' }}>
            {error}
          </p>
        </div>
      </div>
    )
  }

  if (!cluster) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Loading cluster info...
      </div>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '60px 40px', overflowY: 'auto',
      background: 'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 70%)',
    }}>
      {/* Logo */}
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
        boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>Kafbat+</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 40 }}>Kafka cluster overview</p>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 600, marginBottom: 40 }}>
        <StatCard label="Brokers" value={cluster.brokers.length} color="#6366f1" />
        <StatCard label="Topics" value={cluster.topicCount} color="#8b5cf6" />
        <StatCard label="Partitions" value={cluster.totalPartitions} color="#a78bfa" />
      </div>

      {/* Broker list */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        <h2 style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12,
        }}>Brokers</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {cluster.brokers.map(b => (
            <div key={b.id} style={{
              padding: '14px 18px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 8px rgba(34,197,94,0.5)',
              }} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>Broker {b.id}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                {b.host}:{b.port}
              </span>
              {b.isController && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: 10, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>Controller</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      padding: '20px 18px',
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 700, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </div>
  )
}
