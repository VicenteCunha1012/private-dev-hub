import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { vaultApi, type Snippet, type CreateSnippetRequest, type UpdateSnippetRequest } from './api/vaultApi'

// ── Variable parsing ─────────────────────────────────────────────────────────

interface VarDef {
  name: string
  type: 'text' | 'file'
}

function parseVariables(command: string): VarDef[] {
  const matches = command.match(/\{(?:file:)?\w+\}/g)
  if (!matches) return []
  const seen = new Set<string>()
  const vars: VarDef[] = []
  for (const m of matches) {
    const inner = m.slice(1, -1)
    const isFile = inner.startsWith('file:')
    const name = isFile ? inner.slice(5) : inner
    if (!seen.has(name)) {
      seen.add(name)
      vars.push({ name, type: isFile ? 'file' : 'text' })
    }
  }
  return vars
}

function substituteVariables(command: string, values: Record<string, string>): string {
  let result = command
  for (const [key, val] of Object.entries(values)) {
    result = result.replaceAll(`{file:${key}}`, val)
    result = result.replaceAll(`{${key}}`, val)
  }
  return result
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
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
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

  useEffect(() => { loadSnippets() }, [loadSnippets])
  useEffect(() => { loadTags() }, [loadTags])

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

  const handleRun = useCallback(async () => {
    if (!selected) return
    const cmd = variables.length > 0
      ? substituteVariables(selected.command, varValues)
      : selected.command
    if (variables.length > 0) saveVarHistory(varValues)
    setExecRunning(true)
    setExecResult(null)
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
      setExecResult({ exitCode: -1, stdout: '', stderr: `Failed to connect to executor: ${e instanceof Error ? e.message : 'unknown'}` })
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
          }}>+</button>
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
                onClick={() => { setSelectedId(s.id); setShowVarForm(false); setExecResult(null) }}
                style={{
                  padding: '10px 10px', borderRadius: 'var(--radius)', cursor: 'pointer',
                  marginBottom: 2,
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
              </div>
            )
          })}
          {snippets.length === 0 && !error && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
              No snippets found
            </div>
          )}
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

        {!selected && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-dim)' }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>&gt;_</div>
            <div style={{ fontSize: 14 }}>Select a snippet or create a new one</div>
          </div>
        )}

        {selected && (
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
                  {showVarForm ? 'Expanded' : 'Expand'}
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
                    <button onClick={handleRun} disabled={execRunning} style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: execRunning ? 'var(--text-dim)' : '#22c55e',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                      opacity: execRunning ? 0.6 : 1,
                    }}>{execRunning ? 'Running...' : 'Run'}</button>
                    <button onClick={handleCopy} style={{
                      padding: '6px 14px', borderRadius: 6,
                      background: copyFeedback ? 'var(--success)' : 'var(--accent-solid)',
                      color: '#fff', fontSize: 12, fontWeight: 500,
                    }}>{copyFeedback ? 'Copied!' : 'Copy'}</button>
                  </div>
                </div>
              )
            })()}

            {/* Execution output */}
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
                      color: execResult.timedOut ? 'var(--warning)' : execResult.exitCode === 0 ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {execResult.timedOut ? 'Timed out' : `exit ${execResult.exitCode}`}
                    </span>
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
