import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { vaultApi, type Snippet, type Flow, type CreateSnippetRequest, type UpdateSnippetRequest } from './api/vaultApi'
import { parseVariables, substituteVariables, type VarDef } from './lib/variables'

const FlowEditor = lazy(() => import('./components/FlowEditor'))

const NODE_COLORS: Record<string, string> = { start: '#fbbf24', command: '#ec4899', constant: '#4ade80', display: '#38bdf8' }

function flowThumbnail(graphJson: string): Array<{ x: number; y: number; color: string }> {
  try {
    const graph = JSON.parse(graphJson)
    const nodes: Array<{ type?: string; position?: { x: number; y: number } }> = graph.nodes ?? []
    if (nodes.length === 0) return []
    const xs = nodes.map(n => n.position?.x ?? 0)
    const ys = nodes.map(n => n.position?.y ?? 0)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const rangeX = maxX - minX || 1
    const rangeY = maxY - minY || 1
    return nodes.map(n => ({
      x: ((n.position?.x ?? 0) - minX) / rangeX * 46 + 3,
      y: ((n.position?.y ?? 0) - minY) / rangeY * 30 + 3,
      color: NODE_COLORS[n.type ?? ''] ?? '#7a7395',
    }))
  } catch { return [] }
}

const VAR_HISTORY_KEY = 'command-vault-var-history'

function loadVarHistory(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(VAR_HISTORY_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveVarHistory(values: Record<string, string>): void {
  const history = loadVarHistory()
  for (const [key, val] of Object.entries(values)) {
    if (!val) continue
    const prev = history[key] ?? []
    const filtered = prev.filter(v => v !== val)
    history[key] = [val, ...filtered].slice(0, 10)
  }
  localStorage.setItem(VAR_HISTORY_KEY, JSON.stringify(history))
}

function CommandPreview({ command, variables, varValues }: {
  command: string; variables: VarDef[]; varValues: Record<string, string>
}) {
  const varNames = variables.map(v => v.name)
  const parts: { text: string; type: 'literal' | 'filled' | 'placeholder' }[] = []
  const escaped = varNames.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const pattern = new RegExp(`(\\{(?:file:)?(?:${escaped})\\})`)
  const segments = command.split(pattern)
  for (const seg of segments) {
    const match = seg.match(/^\{(?:file:)?(\w+)\}$/)
    if (match && varNames.includes(match[1])) {
      const val = varValues[match[1]]
      if (val) {
        parts.push({ text: val, type: 'filled' })
      } else {
        parts.push({ text: seg, type: 'placeholder' })
      }
    } else {
      parts.push({ text: seg, type: 'literal' })
    }
  }
  return (
    <div style={{
      background: '#0a0914', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '12px 16px', marginTop: 12,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
        Preview
      </div>
      <pre style={{
        margin: 0, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
      }}>
        {parts.map((p, i) => {
          if (p.type === 'filled') return <span key={i} style={{ color: 'var(--accent)' }}>{p.text}</span>
          if (p.type === 'placeholder') return <span key={i} style={{ color: 'var(--text-dim)', opacity: 0.5 }}>{p.text}</span>
          return <span key={i} style={{ color: 'var(--text)' }}>{p.text}</span>
        })}
      </pre>
    </div>
  )
}

// ── File Path Input ─────────────────────────────────────────────────────────

const TTYD_BASE = 'http://localhost:10600'

interface FEntry { name: string; path: string; isDir: boolean }

function FilePickerModal({ initialPath, onSelect, onClose }: {
  initialPath: string; onSelect: (path: string) => void; onClose: () => void
}) {
  const [currentPath, setCurrentPath] = useState(initialPath || '/home')
  const [entries, setEntries] = useState<FEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')

  const fetchDir = useCallback(async (dirPath: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${TTYD_BASE}/files?path=${encodeURIComponent(dirPath)}`)
      if (!res.ok) return
      const data = await res.json()
      setEntries(data.entries)
      setCurrentPath(data.path)
      setFilter('')
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => { fetchDir(currentPath) }, [])

  const parentPath = currentPath === '/' ? null : currentPath.substring(0, currentPath.lastIndexOf('/')) || '/'
  const filtered = filter ? entries.filter(e => e.name.toLowerCase().includes(filter.toLowerCase())) : entries

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card-bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', width: 520, maxHeight: '70vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Select File</span>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--text-muted)' }}>x</button>
        </div>

        {/* Path bar */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          {currentPath.split('/').filter(Boolean).map((seg, i, arr) => {
            const segPath = '/' + arr.slice(0, i + 1).join('/')
            return (
              <span key={segPath} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>/</span>}
                <button onClick={() => fetchDir(segPath)} style={{
                  fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--mono)',
                  padding: '2px 4px', borderRadius: 3,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >{seg}</button>
              </span>
            )
          })}
        </div>

        {/* Filter */}
        <div style={{ padding: '6px 16px' }}>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter..."
            autoFocus
            style={{ fontSize: 12.5, padding: '6px 10px' }}
          />
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {loading && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Loading...</div>}

          {!loading && parentPath !== null && (
            <button onClick={() => fetchDir(parentPath)} style={{
              width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12.5,
              color: 'var(--text-muted)', fontFamily: 'var(--mono)', borderRadius: 4,
              display: 'flex', alignItems: 'center', gap: 8,
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontSize: 14 }}>↩</span> ..
            </button>
          )}

          {!loading && filtered.map(entry => (
            <button
              key={entry.path}
              onClick={() => entry.isDir ? fetchDir(entry.path) : onSelect(entry.path)}
              onDoubleClick={() => onSelect(entry.path)}
              style={{
                width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12.5,
                color: entry.isDir ? '#22c55e' : 'var(--text)',
                fontFamily: 'var(--mono)', borderRadius: 4,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 }}>
                {entry.isDir ? '📁' : '📄'}
              </span>
              {entry.name}{entry.isDir ? '/' : ''}
            </button>
          ))}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
              {filter ? 'No matches' : 'Empty directory'}
            </div>
          )}
        </div>

        {/* Footer with current path + select dir button */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {currentPath}
          </span>
          <button onClick={() => onSelect(currentPath)} style={{
            padding: '6px 14px', borderRadius: 6,
            border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12,
            flexShrink: 0, marginLeft: 8,
          }}>Select directory</button>
        </div>
      </div>
    </div>
  )
}

function FilePathInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, fontSize: 12.5, fontFamily: 'var(--mono)' }}
        />
        <button onClick={() => setShowPicker(true)} style={{
          padding: '4px 10px', borderRadius: 4, border: '1px solid var(--border)',
          color: '#22c55e', fontSize: 11, fontWeight: 500, flexShrink: 0,
        }}>Browse</button>
      </div>
      {showPicker && (
        <FilePickerModal
          initialPath={value ? (value.includes('/') ? value.substring(0, value.lastIndexOf('/')) || '/' : '/home') : '/home'}
          onSelect={path => { onChange(path); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

// ── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
        padding: 24, minWidth: 480, maxWidth: 600, maxHeight: '80vh', overflow: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--text-muted)' }}>x</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Tag Badge ────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      background: 'var(--accent-glow)', color: 'var(--accent-2)',
      fontSize: 11, fontWeight: 500, marginRight: 4, marginBottom: 2,
    }}>
      {tag}
    </span>
  )
}

// ── Snippet Form ─────────────────────────────────────────────────────────────

function SnippetForm({ initial, onSubmit, onCancel, submitLabel }: {
  initial?: Snippet
  onSubmit: (data: CreateSnippetRequest | UpdateSnippetRequest) => void
  onCancel: () => void
  submitLabel: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [command, setCommand] = useState(initial?.command ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [tags, setTags] = useState(initial?.tags ?? '')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Docker restart" />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Command</label>
        <textarea
          value={command} onChange={e => setCommand(e.target.value)}
          placeholder="e.g. docker restart {container}"
          rows={4}
          style={{ fontFamily: 'var(--mono)', fontSize: 13, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Description</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
      </div>
      <div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Tags (comma-separated)</label>
        <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. docker, devops" />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', color: 'var(--text-muted)',
        }}>Cancel</button>
        <button onClick={() => onSubmit({ title, command, description: description || undefined, tags: tags || undefined })} style={{
          padding: '8px 16px', borderRadius: 'var(--radius)',
          background: 'var(--accent-solid)', color: '#fff', fontWeight: 500,
        }}>
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<'commands' | 'flows'>('commands')
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [flows, setFlows] = useState<Flow[]>([])
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null)
  const [pendingFlowCommand, setPendingFlowCommand] = useState<{ title: string; command: string } | undefined>(undefined)
  const [hoveredSnippetId, setHoveredSnippetId] = useState<number | null>(null)
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null)
  const [editingFlowName, setEditingFlowName] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, items: any[]} | null>(null)

  // Spotlight deep-link
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'spotlight-navigate') {
        if (e.data.action === 'open-command') {
          const id = e.data.value as number
          setSelectedId(id)
          setView('commands')
          setShowVarForm(true)
        } else if (e.data.action === 'open-flow') {
          const id = e.data.value as number
          setSelectedFlowId(id)
          setView('flows')
        }
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])
  const [tagFilter, setTagFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [varValues, setVarValues] = useState<Record<string, string>>({})
  const [showVarForm, setShowVarForm] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [execResult, setExecResult] = useState<{ exitCode: number; stdout: string; stderr: string; timedOut?: boolean } | null>(null)
  const [execRunning, setExecRunning] = useState(false)
  const [workdir, setWorkdir] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => snippets.find(s => s.id === selectedId) ?? null, [snippets, selectedId])
  const variables = useMemo(() => selected ? parseVariables(selected.command) : [], [selected])

  const loadSnippets = useCallback(async () => {
    try {
      const data = await vaultApi.getSnippets(search || undefined, tagFilter || undefined)
      setSnippets(data)
      setError(null)
    } catch {
      setError('Backend unreachable -- make sure the command-vault backend is running on port 10409.')
    }
  }, [search, tagFilter])

  const loadTags = useCallback(async () => {
    try {
      const tags = await vaultApi.getTags()
      setAllTags(tags)
    } catch { /* ignore */ }
  }, [])

  const loadFlows = useCallback(async () => {
    try { setFlows(await vaultApi.getFlows()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadSnippets() }, [loadSnippets])
  useEffect(() => { loadTags() }, [loadTags])
  useEffect(() => { loadFlows() }, [loadFlows])

  const handleCreate = useCallback(async (data: CreateSnippetRequest | UpdateSnippetRequest) => {
    try {
      const created = await vaultApi.createSnippet(data as CreateSnippetRequest)
      setShowCreate(false)
      await loadSnippets()
      await loadTags()
      setSelectedId(created.id)
    } catch (e) {
      console.error('Failed to create snippet', e)
    }
  }, [loadSnippets, loadTags])

  const handleUpdate = useCallback(async (data: CreateSnippetRequest | UpdateSnippetRequest) => {
    if (!selectedId) return
    try {
      await vaultApi.updateSnippet(selectedId, data as UpdateSnippetRequest)
      setShowEdit(false)
      await loadSnippets()
      await loadTags()
    } catch (e) {
      console.error('Failed to update snippet', e)
    }
  }, [selectedId, loadSnippets, loadTags])

  const handleDelete = useCallback(async () => {
    if (!selectedId) return
    if (!confirm('Delete this snippet?')) return
    try {
      await vaultApi.deleteSnippet(selectedId)
      setSelectedId(null)
      await loadSnippets()
      await loadTags()
    } catch (e) {
      console.error('Failed to delete snippet', e)
    }
  }, [selectedId, loadSnippets, loadTags])

  const handleExpand = useCallback(() => {
    if (!selected) return
    if (!showVarForm) {
      const initial: Record<string, string> = {}
      for (const v of variables) initial[v.name] = varValues[v.name] ?? ''
      setVarValues(initial)
      setShowVarForm(true)
    }
  }, [selected, variables, showVarForm, varValues])

  const handleCopy = useCallback(() => {
    if (!selected) return
    const text = variables.length > 0
      ? substituteVariables(selected.command, varValues)
      : selected.command
    navigator.clipboard.writeText(text).then(() => {
      if (variables.length > 0) saveVarHistory(varValues)
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 1500)
    })
  }, [selected, variables, varValues])

  // Keyboard shortcuts
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (view === 'flows') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'f') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'n') { e.preventDefault(); setShowCreate(true) }
      if (e.key === 'e') { e.preventDefault(); handleExpand() }
      if (e.key === 'Escape') { e.preventDefault(); if (showVarForm) { setShowVarForm(false) } else { setSelectedId(null) } }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedId(prev => {
          const idx = snippets.findIndex(s => s.id === prev)
          if (idx < snippets.length - 1) return snippets[idx + 1].id
          if (idx === -1 && snippets.length > 0) return snippets[0].id
          return prev
        })
        setShowVarForm(false); setExecResult(null)
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedId(prev => {
          const idx = snippets.findIndex(s => s.id === prev)
          if (idx > 0) return snippets[idx - 1].id
          return prev
        })
        setShowVarForm(false); setExecResult(null)
      }
    }
    document.addEventListener('keydown', handle, true)
    return () => document.removeEventListener('keydown', handle, true)
  }, [snippets, showVarForm, handleExpand, view])

  const [terminalUrl, setTerminalUrl] = useState<string | null>(null)

  const handleRun = useCallback(async () => {
    if (!selected) return
    const cmd = variables.length > 0
      ? substituteVariables(selected.command, varValues)
      : selected.command
    if (variables.length > 0) saveVarHistory(varValues)
    setExecRunning(true)
    setExecResult(null)
    setTerminalUrl(null)
    try {
      const res = await fetch('http://localhost:10600/tuis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `run-${selected.title}`, workdir: workdir || '/home/cunvic', command: cmd }),
      })
      const data = await res.json()
      if (data.url) {
        setTerminalUrl(data.url)
        setShowVarForm(false)
      } else {
        setExecResult({ exitCode: -1, stdout: '', stderr: data.error || 'Failed to create terminal' })
      }
    } catch (e) {
      setExecResult({ exitCode: -1, stdout: '', stderr: `Failed to connect to ttyd: ${e instanceof Error ? e.message : 'unknown'}` })
    } finally {
      setExecRunning(false)
    }
  }, [selected, variables, varValues, workdir])

  const handleQuickRun = useCallback(async () => {
    if (!selected) return
    const cmd = variables.length > 0
      ? substituteVariables(selected.command, varValues)
      : selected.command
    if (variables.length > 0) saveVarHistory(varValues)
    setExecRunning(true)
    setExecResult(null)
    setTerminalUrl(null)
    try {
      const res = await fetch('http://localhost:10600/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd, timeoutSeconds: 30, ...(workdir ? { workdir } : {}) }),
      })
      const data = await res.json()
      setExecResult(data)
      setShowVarForm(false)
    } catch (e) {
      setExecResult({ exitCode: -1, stdout: '', stderr: `Failed to connect: ${e instanceof Error ? e.message : 'unknown'}` })
    } finally {
      setExecRunning(false)
    }
  }, [selected, variables, varValues, workdir])

  const selectedTags = useMemo(() => {
    if (!selected?.tags) return []
    return selected.tags.split(',').map(t => t.trim()).filter(Boolean)
  }, [selected])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '16px 16px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>Command Vault</span>
          <button onClick={() => setShowCreate(true)} style={{
            width: 28, height: 28, borderRadius: 6, background: 'var(--accent-solid)',
            color: '#fff', fontWeight: 700, fontSize: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }} title="New snippet (n)">+</button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px' }}>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search snippets..."
            style={{ fontSize: 12.5 }}
          />
        </div>

        {/* Tag filter */}
        <div style={{ padding: '0 12px 8px' }}>
          <select
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            style={{ fontSize: 12.5, padding: '6px 8px' }}
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Snippet list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {snippets.map(s => {
            const isActive = s.id === selectedId
            const snippetTags = s.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? []
            const firstLine = s.command.split('\n')[0]
            return (
              <div
                key={s.id}
                onClick={() => { setSelectedId(s.id); setShowVarForm(false); setExecResult(null); setView('commands') }}
                onContextMenu={e => {
                  e.preventDefault()
                  setCtxMenu({
                    x: e.clientX, y: e.clientY,
                    items: [
                      { label: 'Expand', icon: '📖', onClick: () => { setSelectedId(s.id); setShowVarForm(true) } },
                      { label: 'Edit', icon: '✏️', onClick: () => { setSelectedId(s.id); setShowEdit(true) } },
                      { label: 'Quick Run', icon: '⚡', onClick: () => { setSelectedId(s.id) } },
                      { label: 'Run in Terminal', icon: '🖥️', onClick: () => { setSelectedId(s.id) } },
                      { label: 'Add to Flow', icon: '⚡', onClick: () => {
                        if (!selectedFlowId) {
                          vaultApi.createFlow({ name: `Flow: ${s.title}` }).then(flow => {
                            loadFlows()
                            setSelectedFlowId(flow.id)
                            setPendingFlowCommand({ title: s.title, command: s.command })
                            setView('flows')
                          })
                        } else {
                          setPendingFlowCommand({ title: s.title, command: s.command })
                          setView('flows')
                        }
                      }},
                      { label: '', icon: '', divider: true, onClick: () => {} },
                      { label: 'Copy command', icon: '📋', onClick: () => navigator.clipboard.writeText(s.command) },
                      { label: '', icon: '', divider: true, onClick: () => {} },
                      { label: 'Delete', icon: '🗑', danger: true, onClick: () => { if (confirm('Delete snippet?')) { vaultApi.deleteSnippet(s.id).then(() => { loadSnippets(); loadTags(); if (selectedId === s.id) setSelectedId(null) }) } } },
                    ]
                  })
                }}
                onMouseEnter={() => setHoveredSnippetId(s.id)}
                onMouseLeave={() => setHoveredSnippetId(null)}
                style={{
                  padding: '10px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                  marginBottom: 2, position: 'relative',
                  background: isActive ? 'var(--active-bg)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13, color: isActive ? 'var(--active-text)' : 'var(--text)', marginBottom: 3 }}>
                  {s.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {firstLine}
                </div>
                {snippetTags.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {snippetTags.map(t => <TagBadge key={t} tag={t} />)}
                  </div>
                )}
                {hoveredSnippetId === s.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!selectedFlowId) {
                        vaultApi.createFlow({ name: `Flow: ${s.title}` }).then(flow => {
                          loadFlows()
                          setSelectedFlowId(flow.id)
                          setPendingFlowCommand({ title: s.title, command: s.command })
                          setView('flows')
                        })
                      } else {
                        setPendingFlowCommand({ title: s.title, command: s.command })
                        setView('flows')
                      }
                    }}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)',
                      color: '#fbbf24', borderRadius: 4, padding: '2px 6px',
                      fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                    title="Add to flow"
                  >
                    ⚡ Flow
                  </button>
                )}
              </div>
            )
          })}
          {snippets.length === 0 && !error && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
              No snippets found
            </div>
          )}
        </div>

        {/* Flows section */}
        <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              ⚡ Flows
            </span>
            <button onClick={() => vaultApi.createFlow({ name: 'New Flow' }).then(() => loadFlows())}
              style={{ width: 18, height: 18, borderRadius: 4, background: 'var(--accent-solid)', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '0 8px 8px' }}>
            {flows.map(f => {
              const isActive = f.id === selectedFlowId && view === 'flows'
              const isEditing = f.id === editingFlowId
              const thumb = flowThumbnail(f.graphJson)
              return (
                <div key={f.id}
                  onClick={() => { if (!isEditing) { setSelectedFlowId(f.id); setView('flows'); setSelectedId(null) } }}
                  onDoubleClick={() => { setEditingFlowId(f.id); setEditingFlowName(f.name) }}
                  onContextMenu={e => {
                    e.preventDefault()
                    setCtxMenu({
                      x: e.clientX, y: e.clientY,
                      items: [
                        { label: 'Rename', icon: '✏️', onClick: () => { setEditingFlowId(f.id); setEditingFlowName(f.name) } },
                        { label: 'Delete', icon: '🗑', danger: true, onClick: () => { if (confirm('Delete this flow?')) { vaultApi.deleteFlow(f.id).then(() => { loadFlows(); if (selectedFlowId === f.id) setSelectedFlowId(null) }) } } },
                      ]
                    })
                  }}
                  style={{
                    padding: '12px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                    marginBottom: 4,
                    background: isActive ? 'var(--active-bg)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--accent-2)' : '3px solid transparent',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                  {/* Mini thumbnail */}
                  <div style={{
                    width: 56, height: 40, flexShrink: 0, borderRadius: 5,
                    background: '#0a0914', border: '1px solid var(--border)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {thumb.map((dot, i) => (
                      <div key={i} style={{
                        position: 'absolute', left: dot.x, top: dot.y,
                        width: 6, height: 4, borderRadius: 1.5,
                        background: dot.color,
                      }} />
                    ))}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input value={editingFlowName}
                        onChange={e => setEditingFlowName(e.target.value)}
                        onBlur={() => {
                          if (editingFlowName.trim() && editingFlowName !== f.name) {
                            vaultApi.updateFlow(f.id, { name: editingFlowName.trim() }).then(() => loadFlows())
                          }
                          setEditingFlowId(null)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') setEditingFlowId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        style={{ fontSize: 13, padding: '2px 6px', width: '100%', minWidth: 0 }}
                      />
                    ) : (
                      <>
                        <div style={{
                          fontSize: 14, fontWeight: isActive ? 600 : 500,
                          color: isActive ? 'var(--active-text)' : 'var(--text)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
                          {thumb.length} node{thumb.length !== 1 ? 's' : ''}
                        </div>
                      </>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm('Delete this flow?')) { vaultApi.deleteFlow(f.id).then(() => { loadFlows(); if (selectedFlowId === f.id) setSelectedFlowId(null) }) } }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 10, cursor: 'pointer', padding: '0 2px', flexShrink: 0, opacity: 0.4 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                  >✕</button>
                </div>
              )
            })}
            {flows.length === 0 && (
              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-dim)', fontSize: 11, fontStyle: 'italic' }}>No flows yet</div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {error && (
          <div style={{
            padding: '10px 18px', background: '#2a0f0f', borderBottom: '1px solid #5a2020',
            color: '#f87171', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {view === 'flows' && selectedFlowId && (
          <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>Loading editor...</div>}>
            <FlowEditor flowId={selectedFlowId} initialCommand={pendingFlowCommand} />
          </Suspense>
        )}

        {view === 'flows' && !selectedFlowId && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>⚡</div>
            <div style={{ fontSize: 14 }}>Select a flow or create a new one</div>
          </div>
        )}

        {view === 'commands' && !selected && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>&gt;_</div>
            <div style={{ fontSize: 14 }}>Select a snippet or create a new one</div>
          </div>
        )}

        {view === 'commands' && selected && (
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>{selected.title}</h1>
                {selectedTags.length > 0 && (
                  <div>{selectedTags.map(t => <TagBadge key={t} tag={t} />)}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowEdit(true)} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12.5,
                }}>Edit</button>
                <button onClick={handleDelete} style={{
                  padding: '6px 14px', borderRadius: 'var(--radius)',
                  border: '1px solid #5a2020', color: 'var(--danger)', fontSize: 12.5,
                }}>Delete</button>
              </div>
            </div>

            {/* Description */}
            {selected.description && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 16, lineHeight: 1.6 }}>
                {selected.description}
              </p>
            )}

            {/* Command block */}
            <div style={{
              background: '#0a0914', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', borderBottom: '1px solid var(--border)',
                background: 'var(--card-bg)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>Command</span>
                <button onClick={handleExpand} style={{
                  padding: '4px 12px', borderRadius: 6,
                  background: showVarForm ? 'var(--text-dim)' : 'var(--accent-solid)',
                  color: '#fff', fontSize: 12, fontWeight: 500,
                }}>
                  {showVarForm ? 'Expanded' : 'Expand'}<kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px', marginLeft: 4, lineHeight: 1.5 }}>e</kbd>
                </button>
              </div>
              <pre style={{
                padding: '14px 16px', margin: 0,
                fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7,
                color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              }}>
                {selected.command}
              </pre>
            </div>

            {/* Expanded action panel */}
            {showVarForm && (() => {
              const history = loadVarHistory()
              return (
                <div style={{
                  marginTop: 12, padding: 16, background: 'var(--card-bg)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                }}>
                  {variables.length > 0 && (
                    <>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500 }}>
                        Fill in variables:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {variables.map(v => (
                          <div key={v.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <label style={{ fontSize: 12.5, color: v.type === 'file' ? '#22c55e' : 'var(--accent-2)', fontFamily: 'var(--mono)', minWidth: 120 }}>
                              {v.type === 'file' ? `{file:${v.name}}` : `{${v.name}}`}
                            </label>
                            {v.type === 'file' ? (
                              <FilePathInput
                                value={varValues[v.name] ?? ''}
                                onChange={val => setVarValues(prev => ({ ...prev, [v.name]: val }))}
                                placeholder={`Path for ${v.name}`}
                              />
                            ) : (
                              <>
                                <input
                                  value={varValues[v.name] ?? ''}
                                  onChange={e => setVarValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                                  placeholder={`Value for ${v.name}`}
                                  list={`varhistory-${v.name}`}
                                  style={{ flex: 1, fontSize: 12.5 }}
                                />
                                {(history[v.name]?.length ?? 0) > 0 && (
                                  <datalist id={`varhistory-${v.name}`}>
                                    {history[v.name].map(val => <option key={val} value={val} />)}
                                  </datalist>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <CommandPreview command={selected.command} variables={variables} varValues={varValues} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>Working dir:</label>
                    <FilePathInput
                      value={workdir}
                      onChange={setWorkdir}
                      placeholder="~ (default)"
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowVarForm(false)} style={{
                      padding: '6px 14px', borderRadius: 6,
                      border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12,
                    }}>Collapse</button>
                    <button onClick={handleQuickRun} disabled={execRunning} style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: execRunning ? 'var(--text-dim)' : '#0ea5e9',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                      opacity: execRunning ? 0.6 : 1,
                    }} title="Run and capture output (30s timeout)">{execRunning ? 'Running...' : 'Quick Run'}</button>
                    <button onClick={handleRun} disabled={execRunning} style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: execRunning ? 'var(--text-dim)' : '#22c55e',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                      opacity: execRunning ? 0.6 : 1,
                    }} title="Run in interactive terminal">Terminal</button>
                    <button onClick={handleCopy} style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: copyFeedback ? 'var(--success)' : 'var(--accent-solid)',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                    }}>{copyFeedback ? 'Copied!' : 'Copy Command'}</button>
                  </div>
                </div>
              )
            })()}

            {/* Terminal output */}
            {terminalUrl && (
              <div style={{
                marginTop: 12, background: '#0a0914', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  background: 'var(--card-bg)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Terminal
                  </span>
                  <button onClick={() => setTerminalUrl(null)} style={{
                    fontSize: 14, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer',
                  }}>×</button>
                </div>
                <iframe
                  src={terminalUrl}
                  style={{ width: '100%', height: 350, border: 'none' }}
                  allow="fullscreen"
                />
              </div>
            )}

            {/* Execution error output */}
            {execResult && (
              <div style={{
                marginTop: 12, background: '#0a0914', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', borderBottom: '1px solid var(--border)',
                  background: 'var(--card-bg)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Output
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: execResult.exitCode === 0 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      exit {execResult.exitCode}
                    </span>
                    <button onClick={() => {
                      navigator.clipboard.writeText(execResult.stdout + (execResult.stderr ? '\n' + execResult.stderr : ''))
                    }} style={{
                      padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                      fontSize: 10, cursor: 'pointer',
                    }}>Copy Output</button>
                    <button onClick={() => setExecResult(null)} style={{
                      fontSize: 14, color: 'var(--text-dim)', background: 'none', border: 'none', cursor: 'pointer',
                    }}>×</button>
                  </div>
                </div>
                <pre style={{
                  padding: '12px 16px', margin: 0, maxHeight: 400, overflowY: 'auto',
                  fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6,
                  color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {execResult.stdout || '(no output)'}
                </pre>
                {execResult.stderr && (
                  <pre style={{
                    padding: '8px 16px', margin: 0, borderTop: '1px solid var(--border)',
                    fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5,
                    color: 'var(--danger)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                    background: 'rgba(239,68,68,0.04)',
                  }}>
                    {execResult.stderr}
                  </pre>
                )}
              </div>
            )}

            {/* Meta */}
            <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-dim)' }}>
              Created: {new Date(selected.createdAt).toLocaleString()} | Updated: {new Date(selected.updatedAt).toLocaleString()}
            </div>
          </div>
        )}
      </main>

      {ctxMenu && <ContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}

      {/* ── Modals ──────────────────────────────────────────────────────── */}
      {showCreate && (
        <Modal title="New Snippet" onClose={() => setShowCreate(false)}>
          <SnippetForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} submitLabel="Create" />
        </Modal>
      )}

      {showEdit && selected && (
        <Modal title="Edit Snippet" onClose={() => setShowEdit(false)}>
          <SnippetForm initial={selected} onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} submitLabel="Save" />
        </Modal>
      )}
    </div>
  )
}

function ContextMenu({ menu, onClose }: {
  menu: { x: number, y: number, items: Array<{label: string, icon?: string, shortcut?: string, danger?: boolean, disabled?: boolean, divider?: boolean, onClick: () => void}> },
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect()
        let x = menu.x, y = menu.y
        if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8
        if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8
        setPos({ x, y })
      }
      setVisible(true)
    })
  }, [menu.x, menu.y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick, true)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick, true) }
  }, [onClose])

  return (
    <div ref={ref} style={{
      position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
      background: '#1a1730', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
      boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(12px)', padding: '4px 0', minWidth: 180,
      transform: visible ? 'scale(1)' : 'scale(0.95)',
      opacity: visible ? 1 : 0,
      transition: 'transform 120ms ease-out, opacity 120ms ease-out',
      transformOrigin: 'top left',
    }}>
      {menu.items.map((item, i) => {
        if (item.divider) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
        return (
          <div key={i}
            onClick={(e) => { e.stopPropagation(); if (!item.disabled) { item.onClick(); onClose() } }}
            style={{
              padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: item.disabled ? 'default' : 'pointer',
              fontSize: 12.5, color: item.danger ? '#f87171' : item.disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
              opacity: item.disabled ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!item.disabled) (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            {item.icon && <span style={{ fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>}
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.shortcut && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginLeft: 16 }}>{item.shortcut}</span>}
          </div>
        )
      })}
    </div>
  )
}
