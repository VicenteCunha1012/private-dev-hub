import { useCallback, useState } from 'react'
import { kafkaApi } from '../api/kafkaApi'

interface CreateTopicModalProps {
  onClose: () => void
  onCreated: () => void
  clusterId?: number | null
}

export default function CreateTopicModal({ onClose, onCreated, clusterId }: CreateTopicModalProps) {
  const [name, setName] = useState('')
  const [partitions, setPartitions] = useState(1)
  const [replication, setReplication] = useState(1)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setCreating(true)
    setError(null)
    try {
      await kafkaApi.createTopic(name.trim(), partitions, replication, clusterId)
      onCreated()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create topic')
    } finally {
      setCreating(false)
    }
  }, [name, partitions, replication, onCreated, onClose, clusterId])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 420,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Create Topic</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Topic Name
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="my-topic"
              style={{ marginTop: 4 }}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Partitions
              </label>
              <input
                type="number" min={1}
                value={partitions}
                onChange={e => setPartitions(Number(e.target.value))}
                style={{ marginTop: 4 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Replication Factor
              </label>
              <input
                type="number" min={1}
                value={replication}
                onChange={e => setReplication(Number(e.target.value))}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', fontSize: 12.5,
            border: '1px solid var(--border)', borderRadius: 6,
            color: 'var(--text-muted)',
          }}>Cancel</button>
          <button onClick={handleCreate} disabled={creating || !name.trim()} style={{
            padding: '8px 20px', fontSize: 12.5, fontWeight: 500,
            background: creating ? 'var(--text-dim)' : 'var(--accent)',
            color: '#fff', borderRadius: 6,
            opacity: creating || !name.trim() ? 0.6 : 1,
          }}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
