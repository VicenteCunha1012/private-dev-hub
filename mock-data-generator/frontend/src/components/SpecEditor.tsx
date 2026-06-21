import { useCallback, useEffect, useState } from 'react'
import type { FieldSpec, GenerateResponse, SpecRecord, SpecVersionRecord } from '../api/mockgenApi'
import { mockgenApi } from '../api/mockgenApi'

interface SpecEditorProps {
  specId: number
  onBack: () => void
}

export default function SpecEditor({ specId, onBack }: SpecEditorProps) {
  const [spec, setSpec] = useState<SpecRecord | null>(null)
  const [history, setHistory] = useState<SpecVersionRecord[]>([])
  const [tab, setTab] = useState<'fields' | 'generate' | 'history'>('fields')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    const s = await mockgenApi.getSpec(specId)
    setSpec(s)
    const h = await mockgenApi.getHistory(specId)
    setHistory(h)
  }, [specId])

  useEffect(() => { load() }, [load])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const saveSpec = async () => {
    if (!spec) return
    setSaving(true)
    try {
      const updated = await mockgenApi.updateSpec(specId, spec.spec)
      setSpec(updated)
      showToast('Spec saved (v' + updated.version + ')')
      const h = await mockgenApi.getHistory(specId)
      setHistory(h)
    } finally { setSaving(false) }
  }

  const rollback = async (version: number) => {
    const updated = await mockgenApi.rollback(specId, version)
    setSpec(updated)
    showToast('Rolled back to v' + version)
    const h = await mockgenApi.getHistory(specId)
    setHistory(h)
  }

  const updateField = (entityIdx: number, fieldIdx: number, updates: Partial<FieldSpec>) => {
    if (!spec) return
    setSpec(s => {
      if (!s) return s
      const entities = [...s.spec.entities]
      const fields = [...entities[entityIdx].fields]
      fields[fieldIdx] = { ...fields[fieldIdx], ...updates }
      entities[entityIdx] = { ...entities[entityIdx], fields }
      return { ...s, spec: { ...s.spec, entities } }
    })
  }

  if (!spec) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 2000,
          background: '#0f2e1a', border: '1px solid #2a6a3a', borderRadius: 8,
          padding: '10px 16px', color: '#6ee89a', fontSize: 13, fontWeight: 500,
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{ color: 'var(--text-muted)', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{spec.name}</h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12, marginTop: 2 }}>
            <span>Mode: {spec.mode}</span>
            <span>Version: {spec.version}</span>
            <span>Entities: {spec.spec.entities.length}</span>
            <span>Fields: {spec.spec.entities.reduce((s, e) => s + e.fields.length, 0)}</span>
          </div>
        </div>
        <button onClick={saveSpec} disabled={saving} style={{
          padding: '7px 16px', fontSize: 12, fontWeight: 600,
          background: 'var(--accent)', color: '#fff', borderRadius: 6,
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {(['fields', 'generate', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', fontSize: 12.5, fontWeight: 500,
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'fields' && <FieldsTab spec={spec} updateField={updateField} />}
        {tab === 'generate' && <GenerateTab specId={specId} spec={spec} />}
        {tab === 'history' && <HistoryTab history={history} currentVersion={spec.version} onRollback={rollback} />}
      </div>
    </div>
  )
}

function FieldsTab({ spec, updateField }: { spec: SpecRecord; updateField: (eIdx: number, fIdx: number, u: Partial<FieldSpec>) => void }) {
  return (
    <div style={{ padding: '16px 20px' }}>
      {spec.spec.entities.map((entity, eIdx) => (
        <div key={entity.name} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            {entity.name}
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Field', 'Type', 'Source', 'Provider/Values', 'Nullable', 'Null%', 'Unique', 'Key'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '8px 8px', fontWeight: 600,
                      color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5,
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entity.fields.map((field, fIdx) => (
                  <FieldRow key={field.name} field={field} onChange={u => updateField(eIdx, fIdx, u)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function FieldRow({ field, onChange }: { field: FieldSpec; onChange: (u: Partial<FieldSpec>) => void }) {
  const [expanded, setExpanded] = useState(false)

  const sourceDisplay = () => {
    if (field.source === 'faker-provider') return field.fakerProvider || '—'
    if (field.source === 'enum-from-samples') return field.enumValues?.join(', ') || '—'
    if (field.source === 'range') return `${field.rangeMin ?? ''} – ${field.rangeMax ?? ''}`
    if (field.source === 'constant') return field.constant || '—'
    if (field.source === 'regex-template') return field.template || field.pattern || '—'
    if (field.source === 'reference-to-other-field') return `→ ${field.referenceEntity}.${field.referenceField}`
    return '—'
  }

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <td style={{ padding: '8px', fontWeight: 500, fontFamily: 'monospace' }}>
          <span style={{ marginRight: 4, color: 'var(--text-dim)', fontSize: 10 }}>{expanded ? '▼' : '▶'}</span>
          {field.name}
        </td>
        <td style={{ padding: '8px' }}>
          <select value={field.type} onChange={e => onChange({ type: e.target.value })}
            onClick={e => e.stopPropagation()}
            style={{ width: 'auto', fontSize: 11, padding: '2px 6px', background: 'var(--bg)' }}>
            {['string', 'integer', 'number', 'boolean', 'array', 'object'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </td>
        <td style={{ padding: '8px' }}>
          <select value={field.source} onChange={e => onChange({ source: e.target.value })}
            onClick={e => e.stopPropagation()}
            style={{ width: 'auto', fontSize: 11, padding: '2px 6px', background: 'var(--bg)' }}>
            {['faker-provider', 'enum-from-samples', 'regex-template', 'range', 'constant', 'reference-to-other-field'].map(s =>
              <option key={s} value={s}>{s}</option>
            )}
          </select>
        </td>
        <td style={{ padding: '8px', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sourceDisplay()}
        </td>
        <td style={{ padding: '8px', textAlign: 'center' }}>
          <input type="checkbox" checked={field.nullable} onChange={e => onChange({ nullable: e.target.checked })}
            onClick={e => e.stopPropagation()} style={{ width: 'auto' }} />
        </td>
        <td style={{ padding: '8px', fontSize: 11, fontFamily: 'monospace' }}>{(field.nullRate * 100).toFixed(0)}%</td>
        <td style={{ padding: '8px', textAlign: 'center' }}>
          <input type="checkbox" checked={field.unique} onChange={e => onChange({ unique: e.target.checked })}
            onClick={e => e.stopPropagation()} style={{ width: 'auto' }} />
        </td>
        <td style={{ padding: '8px', textAlign: 'center' }}>
          <input type="checkbox" checked={field.isKey} onChange={e => onChange({ isKey: e.target.checked })}
            onClick={e => e.stopPropagation()} style={{ width: 'auto' }} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: '8px 16px 16px', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <MiniField label="Faker Provider" value={field.fakerProvider || ''} onChange={v => onChange({ fakerProvider: v || null })} />
              <MiniField label="Pattern (regex)" value={field.pattern || ''} onChange={v => onChange({ pattern: v || null })} />
              <MiniField label="Template" value={field.template || ''} onChange={v => onChange({ template: v || null })} />
              <MiniField label="Enum Values (comma-sep)" value={field.enumValues?.join(', ') || ''} onChange={v => onChange({ enumValues: v ? v.split(',').map(s => s.trim()) : null })} />
              <MiniField label="Range Min" value={field.rangeMin?.toString() || ''} onChange={v => onChange({ rangeMin: v ? Number(v) : null })} />
              <MiniField label="Range Max" value={field.rangeMax?.toString() || ''} onChange={v => onChange({ rangeMax: v ? Number(v) : null })} />
              <MiniField label="Constant" value={field.constant || ''} onChange={v => onChange({ constant: v || null })} />
              <MiniField label="Null Rate (0–1)" value={String(field.nullRate)} onChange={v => onChange({ nullRate: Number(v) || 0 })} />
              <MiniField label="Max Length" value={field.maxLength?.toString() || ''} onChange={v => onChange({ maxLength: v ? Number(v) : null })} />
              <MiniField label="Ref Entity" value={field.referenceEntity || ''} onChange={v => onChange({ referenceEntity: v || null })} />
              <MiniField label="Ref Field" value={field.referenceField || ''} onChange={v => onChange({ referenceField: v || null })} />
              <MiniField label="Correlated With" value={field.correlatedWith || ''} onChange={v => onChange({ correlatedWith: v || null })} />
              <MiniField label="Correlation Type" value={field.correlationType || ''} onChange={v => onChange({ correlationType: v || null })} />
              <MiniField label="Conditional On" value={field.conditionalOn || ''} onChange={v => onChange({ conditionalOn: v || null })} />
              <MiniField label="Conditional Value" value={field.conditionalValue || ''} onChange={v => onChange({ conditionalValue: v || null })} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 9.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ fontSize: 11, padding: '4px 8px', marginTop: 2 }} />
    </div>
  )
}

function GenerateTab({ specId, spec }: { specId: number; spec: SpecRecord }) {
  const [count, setCount] = useState(10)
  const [profile, setProfile] = useState<'valid' | 'invalid' | 'edge'>('valid')
  const [seed, setSeed] = useState('')
  const [entityName, setEntityName] = useState(spec.spec.entities[0]?.name || '')
  const [result, setResult] = useState<GenerateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await mockgenApi.generate({
        specId, count, profile,
        seed: seed ? Number(seed) : undefined,
        entityName: entityName || undefined,
      })
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Entity</label>
          <select value={entityName} onChange={e => setEntityName(e.target.value)} style={{ width: 160, fontSize: 12 }}>
            {spec.spec.entities.map(e => <option key={e.name} value={e.name}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Count</label>
          <input type="number" min={1} max={1000} value={count} onChange={e => setCount(Number(e.target.value))} style={{ width: 80, fontSize: 12 }} />
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Profile</label>
          <select value={profile} onChange={e => setProfile(e.target.value as typeof profile)} style={{ width: 100, fontSize: 12 }}>
            <option value="valid">Valid</option>
            <option value="invalid">Invalid</option>
            <option value="edge">Edge</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>Seed</label>
          <input value={seed} onChange={e => setSeed(e.target.value)} placeholder="optional" style={{ width: 90, fontSize: 12 }} />
        </div>
        <button onClick={generate} disabled={loading} style={{
          padding: '8px 16px', fontSize: 12, fontWeight: 600,
          background: 'var(--accent)', color: '#fff', borderRadius: 6,
        }}>
          {loading ? 'Generating...' : 'Generate & Preview'}
        </button>
        <a href={mockgenApi.getExportUrl(specId, 'generate')} download style={{
          padding: '8px 12px', fontSize: 11, border: '1px solid var(--border)',
          borderRadius: 6, color: 'var(--text-muted)', textDecoration: 'none',
        }}>Export generate.py</a>
        {spec.mode === 'api' && (
          <a href={mockgenApi.getExportUrl(specId, 'call_api')} download style={{
            padding: '8px 12px', fontSize: 11, border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-muted)', textDecoration: 'none',
          }}>Export call_api.py</a>
        )}
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, fontSize: 12, marginBottom: 12,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: 'var(--danger)', whiteSpace: 'pre-wrap',
        }}>{error}</div>
      )}

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Entity: <strong style={{ color: 'var(--text)' }}>{result.entityName}</strong></span>
            <span>Profile: <strong style={{ color: 'var(--text)' }}>{result.profile}</strong></span>
            <span>Count: <strong style={{ color: 'var(--text)' }}>{result.count}</strong></span>
          </div>
          <div style={{
            maxHeight: 500, overflowY: 'auto', borderRadius: 8,
            border: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)',
          }}>
            {result.records.map((rec, i) => {
              let formatted: string
              try { formatted = JSON.stringify(JSON.parse(rec), null, 2) } catch { formatted = rec }
              return (
                <pre key={i} style={{
                  padding: '10px 14px', fontSize: 11.5, lineHeight: 1.5,
                  borderBottom: i < result.records.length - 1 ? '1px solid var(--border)' : 'none',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
                }}>
                  {formatted}
                </pre>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryTab({ history, currentVersion, onRollback }: {
  history: SpecVersionRecord[]
  currentVersion: number
  onRollback: (v: number) => void
}) {
  return (
    <div style={{ padding: '16px 20px' }}>
      {history.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No version history</div>
      )}
      {history.map(v => (
        <div key={v.id} style={{
          padding: '12px 16px', marginBottom: 6, borderRadius: 8,
          background: v.version === currentVersion ? 'var(--accent-glow)' : 'var(--card-bg)',
          border: `1px solid ${v.version === currentVersion ? 'var(--accent)' : 'var(--border)'}`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--accent)', minWidth: 40 }}>v{v.version}</span>
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>
            {new Date(v.createdAt).toLocaleString()}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {v.spec.entities.length} entities, {v.spec.entities.reduce((s, e) => s + e.fields.length, 0)} fields
          </span>
          {v.version !== currentVersion && (
            <button onClick={() => onRollback(v.version)} style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 500,
              border: '1px solid var(--border)', borderRadius: 5,
              color: 'var(--warning)',
            }}>Rollback</button>
          )}
          {v.version === currentVersion && (
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase' }}>Current</span>
          )}
        </div>
      ))}
    </div>
  )
}
