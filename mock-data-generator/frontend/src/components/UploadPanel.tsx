import { useCallback, useState } from 'react'
import { mockgenApi } from '../api/mockgenApi'

interface UploadPanelProps {
  onSpecCreated: (id: number) => void
}

export default function UploadPanel({ onSpecCreated }: UploadPanelProps) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'kafka' | 'api'>('kafka')
  const [samples, setSamples] = useState<string[]>([''])
  const [schema, setSchema] = useState('')
  const [schemaType, setSchemaType] = useState<'openapi' | 'java'>('openapi')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSample = () => setSamples(s => [...s, ''])
  const removeSample = (i: number) => setSamples(s => s.filter((_, j) => j !== i))
  const updateSample = (i: number, v: string) => setSamples(s => s.map((x, j) => j === i ? v : x))

  const handleFileDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateSample(index, reader.result as string)
    reader.readAsText(file)
  }, [])

  const handleSchemaDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSchema(reader.result as string)
    reader.readAsText(file)
    if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) setSchemaType('openapi')
    else if (file.name.endsWith('.java')) setSchemaType('java')
  }, [])

  const infer = async () => {
    const validSamples = samples.filter(s => s.trim())
    if (!name.trim() || validSamples.length === 0) return
    setLoading(true)
    setError(null)
    try {
      const record = await mockgenApi.infer({
        name: name.trim(),
        mode,
        samples: validSamples,
        schema: schema || undefined,
        schemaType: schema ? schemaType : undefined,
      })
      onSpecCreated(record.id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Inference failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, letterSpacing: -0.3 }}>New Spec — Infer from Samples</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <Label>Spec Name</Label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. OrderEvent" />
        </div>
        <div style={{ width: 160 }}>
          <Label>Mode</Label>
          <select value={mode} onChange={e => setMode(e.target.value as 'kafka' | 'api')}>
            <option value="kafka">Kafka</option>
            <option value="api">API</option>
          </select>
        </div>
      </div>

      <Label>JSON Samples ({samples.length})</Label>
      <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        Paste real JSON samples. The more you provide, the better the inference. Drag & drop .json files.
      </p>
      {samples.map((sample, i) => (
        <div key={i} style={{ marginBottom: 8, position: 'relative' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleFileDrop(e, i)}
        >
          <textarea
            value={sample}
            onChange={e => updateSample(i, e.target.value)}
            placeholder={`Sample ${i + 1} — paste JSON or drop a .json file`}
            style={{ minHeight: 120 }}
          />
          {samples.length > 1 && (
            <button onClick={() => removeSample(i)} style={{
              position: 'absolute', top: 6, right: 6,
              fontSize: 16, color: 'var(--danger)', lineHeight: 1,
            }}>×</button>
          )}
        </div>
      ))}
      <button onClick={addSample} style={{
        fontSize: 12, color: 'var(--accent)', fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20,
      }}>
        <span style={{ fontSize: 16 }}>+</span> Add another sample
      </button>

      {mode === 'api' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Label style={{ marginBottom: 0 }}>Schema (optional)</Label>
            <select value={schemaType} onChange={e => setSchemaType(e.target.value as 'openapi' | 'java')}
              style={{ width: 'auto', fontSize: 11, padding: '2px 8px' }}>
              <option value="openapi">OpenAPI YAML</option>
              <option value="java">Java DTOs</option>
            </select>
          </div>
          <div onDragOver={e => e.preventDefault()} onDrop={handleSchemaDrop}>
            <textarea
              value={schema}
              onChange={e => setSchema(e.target.value)}
              placeholder="Paste OpenAPI YAML or Java DTO classes... or drop a file"
              style={{ minHeight: 160 }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', whiteSpace: 'pre-wrap',
        }}>
          {error}
        </div>
      )}

      <button onClick={infer} disabled={loading || !name.trim() || samples.every(s => !s.trim())} style={{
        padding: '10px 24px', fontSize: 13, fontWeight: 600,
        background: loading ? 'var(--text-dim)' : 'var(--accent)',
        color: '#fff', borderRadius: 8,
        opacity: loading || !name.trim() || samples.every(s => !s.trim()) ? 0.6 : 1,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {loading ? (
          <>
            <Spinner /> Inferring spec via AI...
          </>
        ) : (
          'Infer Spec'
        )}
      </button>
    </div>
  )
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'block', ...style }}>
      {children}
    </label>
  )
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
    </svg>
  )
}
