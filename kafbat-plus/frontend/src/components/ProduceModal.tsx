import { useCallback, useState } from 'react'
import type { ProduceResult } from '../api/kafkaApi'
import { kafkaApi } from '../api/kafkaApi'

interface ProduceModalProps {
  topic: string
  onClose: () => void
  onProduced: () => void
}

export default function ProduceModal({ topic, onClose, onProduced }: ProduceModalProps) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('{\n  \n}')
  const [headers, setHeaders] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<ProduceResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

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
      })
      setResult(res)
      onProduced()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to produce')
    } finally {
      setSending(false)
    }
  }, [topic, key, value, headers, onProduced])

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
              </div>
            </div>
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
