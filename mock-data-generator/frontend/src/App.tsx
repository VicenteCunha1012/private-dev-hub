import { useCallback, useEffect, useState } from 'react'
import type { SpecRecord } from './api/mockgenApi'
import { mockgenApi } from './api/mockgenApi'
import SpecEditor from './components/SpecEditor'
import UploadPanel from './components/UploadPanel'

export default function App() {
  const [specs, setSpecs] = useState<SpecRecord[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'n') { e.preventDefault(); setShowUpload(true); setSelectedId(null) }
      if (e.key === 'Escape') { e.preventDefault(); setSelectedId(null) }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedId(prev => {
          const idx = specs.findIndex(s => s.id === prev)
          if (idx < specs.length - 1) return specs[idx + 1].id
          if (idx === -1 && specs.length > 0) return specs[0].id
          return prev
        })
        setShowUpload(false)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedId(prev => {
          const idx = specs.findIndex(s => s.id === prev)
          if (idx > 0) return specs[idx - 1].id
          return prev
        })
        setShowUpload(false)
      }
    }
    document.addEventListener('keydown', handle, true)
    return () => document.removeEventListener('keydown', handle, true)
  }, [specs])

  const loadSpecs = useCallback(async () => {
    try {
      const data = await mockgenApi.getSpecs()
      setSpecs(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    }
  }, [])

  useEffect(() => { loadSpecs() }, [loadSpecs])

  const handleSpecCreated = (id: number) => {
    setShowUpload(false)
    setSelectedId(id)
    loadSpecs()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this spec and all its versions?')) return
    await mockgenApi.deleteSpec(id)
    if (selectedId === id) setSelectedId(null)
    loadSpecs()
  }

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Sidebar */}
      <nav style={{
        width: 280, minWidth: 280, background: 'var(--sidebar-bg)',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid var(--border)', height: '100%', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 14px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0, fontWeight: 700, color: '#fff',
            boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
          }}>
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>Mock Generator</span>
        </div>

        <div style={{ padding: '10px 14px' }}>
          <button onClick={() => { setShowUpload(true); setSelectedId(null) }} style={{
            width: '100%', padding: '8px 12px', fontSize: 12, fontWeight: 600,
            background: 'var(--accent)', color: '#fff', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            <span style={{ fontSize: 16 }}>+</span> New Spec<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>n</kbd>
          </button>
        </div>

        {error && (
          <div style={{
            margin: '0 14px 8px', padding: '8px 10px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 6, fontSize: 11, color: 'var(--danger)',
          }}>{error}</div>
        )}

        <div style={{ padding: '4px 14px 8px' }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Specs ({specs.length})
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {specs.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', marginBottom: 2,
            }}>
              <button
                onClick={() => { setSelectedId(s.id); setShowUpload(false) }}
                style={{
                  flex: 1, textAlign: 'left', padding: '10px 12px',
                  borderRadius: 6,
                  background: selectedId === s.id ? 'var(--accent-glow)' : undefined,
                  borderLeft: selectedId === s.id ? '2px solid var(--accent)' : '2px solid transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (selectedId !== s.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                onMouseLeave={e => { if (selectedId !== s.id) e.currentTarget.style.background = '' }}
              >
                <div style={{ fontSize: 12.5, fontWeight: selectedId === s.id ? 500 : 400, marginBottom: 3 }}>
                  {s.name}
                </div>
                <div style={{ display: 'flex', gap: 8, fontSize: 10, color: 'var(--text-dim)' }}>
                  <span style={{
                    padding: '1px 5px', borderRadius: 3,
                    background: s.mode === 'api' ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                    color: s.mode === 'api' ? 'var(--info)' : 'var(--accent)',
                    fontWeight: 600, textTransform: 'uppercase', fontSize: 9,
                  }}>{s.mode}</span>
                  <span>v{s.version}</span>
                  <span>{s.spec.entities.length} entities</span>
                </div>
              </button>
              <button onClick={() => handleDelete(s.id)} style={{
                color: 'var(--text-dim)', fontSize: 14, padding: '4px 6px',
                opacity: 0.5, flexShrink: 0,
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
              >×</button>
            </div>
          ))}
        </div>
      </nav>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {showUpload && <UploadPanel onSpecCreated={handleSpecCreated} />}
        {selectedId && !showUpload && (
          <SpecEditor key={selectedId} specId={selectedId} onBack={() => setSelectedId(null)} />
        )}
        {!showUpload && !selectedId && <HomeScreen />}
      </main>
    </div>
  )
}

function HomeScreen() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 40px',
      background: 'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 70%)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'linear-gradient(135deg, #10b981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 20,
        boxShadow: '0 4px 24px rgba(16,185,129,0.4)',
      }}>M</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, marginBottom: 8 }}>Mock Data Generator</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
        Generate realistic mock data from real JSON samples. The AI infers a generation spec, then a local deterministic generator (Faker) produces as many records as you need — no API cost per record.
      </p>
    </div>
  )
}
