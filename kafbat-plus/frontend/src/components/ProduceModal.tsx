import { useCallback, useEffect, useState } from 'react'
import type { ProduceResult } from '../api/kafkaApi'
import { kafkaApi } from '../api/kafkaApi'

const MOCKGEN_BASE = 'http://localhost:10408'

interface MockgenSpec { id: number; name: string; mode: string; spec: { entities: { name: string }[] } }
interface MockgenResult { records: string[] }

interface ProduceModalProps {
  topic: string
  onClose: () => void
  onProduced: () => void
  initialValue?: string
  clusterId?: number | null
}

export default function ProduceModal({ topic, onClose, onProduced, initialValue, clusterId }: ProduceModalProps) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState(initialValue ?? '{\n  \n}')
  const [headers, setHeaders] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<ProduceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showMockgen, setShowMockgen] = useState(false)
  const [mockgenSpecs, setMockgenSpecs] = useState<MockgenSpec[]>([])
  const [mockgenAvailable, setMockgenAvailable] = useState(false)
  const [mockgenLoading, setMockgenLoading] = useState(false)

  useEffect(() => {
    fetch(`${MOCKGEN_BASE}/health`).then(r => {
      if (r.ok) {
        setMockgenAvailable(true)
        fetch(`${MOCKGEN_BASE}/specs`).then(r => r.json()).then(setMockgenSpecs).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const generateFromSpec = useCallback(async (specId: number, entityName: string, count: number, profile: string) => {
    setMockgenLoading(true)
    try {
      const res = await fetch(`${MOCKGEN_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specId, count, profile, entityName }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data: MockgenResult = await res.json()
      if (data.records.length === 1) {
        try { setValue(JSON.stringify(JSON.parse(data.records[0]), null, 2)) } catch { setValue(data.records[0]) }
      } else {
        setValue(data.records.map(r => { try { return JSON.stringify(JSON.parse(r), null, 2) } catch { return r } }).join('\n\n'))
      }
      setShowMockgen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Mock generation failed')
    } finally { setMockgenLoading(false) }
  }, [])

  const handleSend = useCallback(async () => {
    setSending(true)
    setError(null)
    setResult(null)
    try {
      const parsedHeaders: Record<string, string> = {}
      if (headers.trim()) {
        for (const line of headers.split('\n')) {
          const idx = line.indexOf(':')
          if (idx > 0) {
            parsedHeaders[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
          }
        }
      }
      const res = await kafkaApi.produce(topic, {
        key: key || undefined,
        value,
        headers: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
      }, clusterId)
      setResult(res)
      onProduced()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to produce')
    } finally {
      setSending(false)
    }
  }, [topic, key, value, headers, onProduced, clusterId])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      try {
        const parsed = JSON.parse(text)
        setValue(JSON.stringify(parsed, null, 2))
      } catch {
        setValue(text)
      }
    }
    reader.readAsText(file)
  }, [])

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const text = reader.result as string
        try {
          const parsed = JSON.parse(text)
          setValue(JSON.stringify(parsed, null, 2))
        } catch {
          setValue(text)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [])

  const formatJson = useCallback(() => {
    try {
      const parsed = JSON.parse(value)
      setValue(JSON.stringify(parsed, null, 2))
    } catch { /* not valid json */ }
  }, [value])

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
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          width: 600, maxHeight: '80vh',
          background: 'var(--bg-secondary)',
          border: `1px solid ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Produce Message</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{topic}</span>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Key */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Key <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="Message key..."
              style={{ marginTop: 4 }}
            />
          </div>

          {/* Value */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Value
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={formatJson} style={{
                  fontSize: 10, color: 'var(--accent)', fontWeight: 500,
                  padding: '2px 6px', borderRadius: 4,
                }}>Format JSON</button>
                <button onClick={handleFileSelect} style={{
                  fontSize: 10, color: 'var(--accent)', fontWeight: 500,
                  padding: '2px 6px', borderRadius: 4,
                }}>Upload File</button>
                {mockgenAvailable && (
                  <button onClick={() => setShowMockgen(!showMockgen)} style={{
                    fontSize: 10, color: '#10b981', fontWeight: 500,
                    padding: '2px 6px', borderRadius: 4,
                  }}>Generate payload</button>
                )}
              </div>
            </div>
            {showMockgen && (
              <MockgenPicker
                specs={mockgenSpecs}
                loading={mockgenLoading}
                onGenerate={generateFromSpec}
                onClose={() => setShowMockgen(false)}
              />
            )}
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              style={{
                minHeight: 200, fontFamily: 'monospace', fontSize: 12,
                lineHeight: 1.6, resize: 'vertical',
              }}
              placeholder='{"message": "hello"}'
            />
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              {dragOver ? '⬆ Drop JSON file here' : `${new Blob([value]).size} bytes · Drag & drop a .json file`}
            </div>
          </div>

          {/* Headers */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Headers <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional, key: value per line)</span>
            </label>
            <textarea
              value={headers}
              onChange={e => setHeaders(e.target.value)}
              placeholder={'content-type: application/json\ncorrelation-id: abc-123'}
              style={{ marginTop: 4, minHeight: 50, fontSize: 12, fontFamily: 'monospace' }}
            />
          </div>

          {/* Result/Error */}
          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)',
            }}>
              {error}
            </div>
          )}
          {result && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 12,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              color: 'var(--success)',
            }}>
              Sent to partition {result.partition}, offset {result.offset}
            </div>
          )}
        </div>

        {/* Footer */}
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
          <button onClick={handleSend} disabled={sending || !value.trim()} style={{
            padding: '8px 20px', fontSize: 12.5, fontWeight: 500,
            background: sending ? 'var(--text-dim)' : 'var(--accent)',
            color: '#fff', borderRadius: 6,
            opacity: sending || !value.trim() ? 0.6 : 1,
          }}>
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MockgenPicker({ specs, loading, onGenerate, onClose }: {
  specs: MockgenSpec[]
  loading: boolean
  onGenerate: (specId: number, entity: string, count: number, profile: string) => void
  onClose: () => void
}) {
  const [specId, setSpecId] = useState(specs[0]?.id ?? 0)
  const [entity, setEntity] = useState('')
  const [count, setCount] = useState(1)
  const [profile, setProfile] = useState('valid')

  const selectedSpec = specs.find(s => s.id === specId)
  const entities = selectedSpec?.spec.entities ?? []

  useEffect(() => {
    if (entities.length > 0 && !entity) setEntity(entities[0].name)
  }, [entities, entity])

  if (specs.length === 0) {
    return (
      <div style={{
        padding: '10px 12px', marginBottom: 8, borderRadius: 6,
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
        fontSize: 11, color: 'var(--text-muted)',
      }}>
        No specs available. Create one in Mock Data Generator first.
        <button onClick={onClose} style={{ marginLeft: 8, color: 'var(--text-dim)', fontSize: 12 }}>×</button>
      </div>
    )
  }

  return (
    <div style={{
      padding: '10px 12px', marginBottom: 8, borderRadius: 6,
      background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Spec</label>
          <select value={specId} onChange={e => { setSpecId(Number(e.target.value)); setEntity('') }}
            style={{ fontSize: 11, padding: '4px 6px', width: 140 }}>
            {specs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Entity</label>
          <select value={entity} onChange={e => setEntity(e.target.value)}
            style={{ fontSize: 11, padding: '4px 6px', width: 120 }}>
            {entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Count</label>
          <input type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))}
            style={{ fontSize: 11, padding: '4px 6px', width: 50 }} />
        </div>
        <div>
          <label style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block' }}>Profile</label>
          <select value={profile} onChange={e => setProfile(e.target.value)}
            style={{ fontSize: 11, padding: '4px 6px', width: 80 }}>
            <option value="valid">Valid</option>
            <option value="invalid">Invalid</option>
            <option value="edge">Edge</option>
          </select>
        </div>
        <button onClick={() => onGenerate(specId, entity, count, profile)} disabled={loading} style={{
          padding: '5px 10px', fontSize: 10, fontWeight: 600,
          background: '#10b981', color: '#fff', borderRadius: 5,
          opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '...' : 'Generate'}
        </button>
        <button onClick={onClose} style={{ color: 'var(--text-dim)', fontSize: 14, padding: '0 4px' }}>×</button>
      </div>
    </div>
  )
}
