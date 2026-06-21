import { useCallback, useState } from 'react'
import type { DiffEntry, DiffResponse } from './api/jsonApi'
import { jsonApi } from './api/jsonApi'

type Tab = 'format' | 'compact' | 'diff'

export default function App() {
  const [tab, setTab] = useState<Tab>('format')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
          boxShadow: '0 2px 8px rgba(245,158,11,0.35)',
        }}>
          {'{ }'}
        </div>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>JSON Tools</span>

        <div style={{ display: 'flex', gap: 2, marginLeft: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3 }}>
          {(['format', 'compact', 'diff'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 18px', fontSize: 12.5, fontWeight: 500,
                borderRadius: 6,
                color: tab === t ? '#fff' : 'var(--text-muted)',
                background: tab === t ? 'var(--accent)' : 'transparent',
                transition: 'background 0.15s, color 0.15s',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'format' && <FormatTab />}
        {tab === 'compact' && <CompactTab />}
        {tab === 'diff' && <DiffTab />}
      </main>
    </div>
  )
}

function FormatTab() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indent, setIndent] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const format = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await jsonApi.format(input, indent)
      setOutput(res.result)
      if (!res.valid) setError(res.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [input, indent])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ToolBar>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
          Indent:
          <select value={indent} onChange={e => setIndent(Number(e.target.value))} style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text)', padding: '4px 8px', fontSize: 12,
          }}>
            {[2, 3, 4].map(n => <option key={n} value={n}>{n} spaces</option>)}
            <option value={1}>Tab</option>
          </select>
        </label>
        <ActionBtn onClick={format} loading={loading}>Format</ActionBtn>
        <CopyBtn text={output} />
        <PasteBtn onPaste={setInput} />
      </ToolBar>
      {error && <ErrorBar>{error}</ErrorBar>}
      <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--border)', overflow: 'hidden' }}>
        <EditorPane
          value={input}
          onChange={setInput}
          placeholder="Paste or type JSON here..."
          label="Input"
          onDrop={text => setInput(text)}
        />
        <EditorPane
          value={output}
          readOnly
          placeholder="Formatted output will appear here"
          label="Output"
        />
      </div>
    </div>
  )
}

function CompactTab() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const compact = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await jsonApi.compact(input)
      setOutput(res.result)
      if (!res.valid) setError(res.error)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [input])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ToolBar>
        <ActionBtn onClick={compact} loading={loading}>Compact</ActionBtn>
        <CopyBtn text={output} />
        <PasteBtn onPaste={setInput} />
        {output && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>
            {input.length} → {output.length} chars ({Math.round((1 - output.length / input.length) * 100)}% smaller)
          </span>
        )}
      </ToolBar>
      {error && <ErrorBar>{error}</ErrorBar>}
      <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--border)', overflow: 'hidden' }}>
        <EditorPane
          value={input}
          onChange={setInput}
          placeholder="Paste formatted JSON here..."
          label="Input"
          onDrop={text => setInput(text)}
        />
        <EditorPane
          value={output}
          readOnly
          placeholder="Compacted output (single line)"
          label="Output"
        />
      </div>
    </div>
  )
}

type LineDiffType = 'added' | 'removed' | 'changed' | null

interface LineDiff {
  leftLines: string[]
  rightLines: string[]
  leftHighlights: LineDiffType[]
  rightHighlights: LineDiffType[]
}

function computeLineDiff(leftJson: string, rightJson: string): LineDiff | null {
  try {
    const leftFormatted = JSON.stringify(JSON.parse(leftJson), null, 2)
    const rightFormatted = JSON.stringify(JSON.parse(rightJson), null, 2)
    const leftLines = leftFormatted.split('\n')
    const rightLines = rightFormatted.split('\n')

    // LCS-based diff for better alignment
    const m = leftLines.length
    const n = rightLines.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (leftLines[i - 1] === rightLines[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // Backtrack to build aligned output
    const alignedLeft: string[] = []
    const alignedRight: string[] = []
    const leftHL: LineDiffType[] = []
    const rightHL: LineDiffType[] = []
    let i = m, j = n
    const stack: Array<[string, string, LineDiffType, LineDiffType]> = []

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
        stack.push([leftLines[i - 1], rightLines[j - 1], null, null])
        i--; j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        stack.push(['', rightLines[j - 1], null, 'added'])
        j--
      } else {
        stack.push([leftLines[i - 1], '', 'removed', null])
        i--
      }
    }

    stack.reverse()
    for (const [l, r, lh, rh] of stack) {
      alignedLeft.push(l)
      alignedRight.push(r)
      leftHL.push(lh)
      rightHL.push(rh)
    }

    return { leftLines: alignedLeft, rightLines: alignedRight, leftHighlights: leftHL, rightHighlights: rightHL }
  } catch {
    return null
  }
}

function DiffTab() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [result, setResult] = useState<DiffResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit')
  const [lineDiff, setLineDiff] = useState<LineDiff | null>(null)

  const compare = useCallback(async () => {
    if (!left.trim() || !right.trim()) return
    setLoading(true)
    try {
      const res = await jsonApi.diff(left, right)
      setResult(res)
      const ld = computeLineDiff(left, right)
      setLineDiff(ld)
      if (ld) setViewMode('diff')
    } catch { /* ignore */ }
    setLoading(false)
  }, [left, right])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      compare()
    }
  }, [compare])

  const backToEdit = () => {
    setViewMode('edit')
    setLineDiff(null)
  }

  const handleEdit = (side: 'left' | 'right') => (v: string) => {
    if (side === 'left') setLeft(v)
    else setRight(v)
    setResult(null)
    setViewMode('edit')
    setLineDiff(null)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <ToolBar>
        <ActionBtn onClick={compare} loading={loading}>Compare</ActionBtn>
        {viewMode === 'diff' && (
          <button onClick={backToEdit} style={{
            padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)',
            border: '1px solid var(--border)', borderRadius: 6,
          }}>
            Edit
          </button>
        )}
        {result && (
          <span style={{
            fontSize: 12, fontWeight: 600, marginLeft: 8,
            color: result.equal ? 'var(--success)' : 'var(--danger)',
          }}>
            {result.equal ? 'Identical' : `${result.differences.length} difference${result.differences.length !== 1 ? 's' : ''}`}
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 4 }}>
          Ctrl+Enter to compare
        </span>
        <SwapBtn onSwap={() => { const t = left; setLeft(right); setRight(t); setResult(null); setViewMode('edit'); setLineDiff(null) }} />
      </ToolBar>
      {result?.error && <ErrorBar>{result.error}</ErrorBar>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--border)', overflow: 'hidden', minHeight: 0 }}>
          {viewMode === 'edit' ? (
            <>
              <EditorPane
                value={left}
                onChange={handleEdit('left')}
                placeholder="Left JSON..."
                label="Left"
                onDrop={text => setLeft(text)}
                onKeyDown={handleKeyDown}
              />
              <EditorPane
                value={right}
                onChange={handleEdit('right')}
                placeholder="Right JSON..."
                label="Right"
                onDrop={text => setRight(text)}
                onKeyDown={handleKeyDown}
              />
            </>
          ) : lineDiff ? (
            <>
              <DiffPane lines={lineDiff.leftLines} highlights={lineDiff.leftHighlights} label="Left" />
              <DiffPane lines={lineDiff.rightLines} highlights={lineDiff.rightHighlights} label="Right" />
            </>
          ) : (
            <>
              <EditorPane
                value={left}
                onChange={handleEdit('left')}
                placeholder="Left JSON..."
                label="Left"
                onDrop={text => setLeft(text)}
                onKeyDown={handleKeyDown}
              />
              <EditorPane
                value={right}
                onChange={handleEdit('right')}
                placeholder="Right JSON..."
                label="Right"
                onDrop={text => setRight(text)}
                onKeyDown={handleKeyDown}
              />
            </>
          )}
        </div>
        {result && !result.equal && result.differences.length > 0 && (
          <div style={{
            maxHeight: 280, overflowY: 'auto', borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ padding: '10px 16px 6px' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Differences
              </span>
            </div>
            {result.differences.map((d, i) => (
              <DiffRow key={i} entry={d} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DiffPane({ lines, highlights, label }: { lines: string[]; highlights: LineDiffType[]; label: string }) {
  const bgMap: Record<string, string> = {
    added: 'rgba(74, 222, 128, 0.1)',
    removed: 'rgba(248, 113, 113, 0.1)',
    changed: 'rgba(251, 191, 36, 0.1)',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
      <div style={{
        padding: '6px 14px', fontSize: 10, fontWeight: 600,
        color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8,
        borderBottom: '1px solid var(--border)',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', fontFamily: 'monospace', fontSize: 13, lineHeight: '20px' }}>
        {lines.map((line, i) => {
          const hl = highlights[i]
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                minHeight: 20,
                background: hl ? bgMap[hl] : 'transparent',
                whiteSpace: 'pre',
              }}
            >
              <span style={{
                width: 44, flexShrink: 0, textAlign: 'right', paddingRight: 12,
                color: 'var(--text-dim)', fontSize: 11, userSelect: 'none',
                borderRight: '1px solid var(--border)',
              }}>
                {line !== '' ? i + 1 : ''}
              </span>
              <span style={{ paddingLeft: 8, color: 'var(--text)' }}>{line}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiffRow({ entry }: { entry: DiffEntry }) {
  const bgMap = { added: 'var(--added-bg)', removed: 'var(--removed-bg)', changed: 'var(--changed-bg)' }
  const borderMap = { added: 'var(--added-border)', removed: 'var(--removed-border)', changed: 'var(--changed-border)' }
  const colorMap = { added: 'var(--success)', removed: 'var(--danger)', changed: 'var(--accent)' }
  const labelMap = { added: 'ADDED', removed: 'REMOVED', changed: 'CHANGED' }

  return (
    <div style={{
      margin: '0 12px 4px', padding: '8px 12px',
      background: bgMap[entry.type], border: `1px solid ${borderMap[entry.type]}`,
      borderRadius: 6, fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
          padding: '1px 5px', borderRadius: 3,
          background: borderMap[entry.type], color: colorMap[entry.type],
        }}>
          {labelMap[entry.type]}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--text)' }}>{entry.path}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 11 }}>
        {entry.leftValue !== null && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 9, textTransform: 'uppercase' }}>left: </span>
            <span style={{ color: 'var(--danger)', wordBreak: 'break-all' }}>{entry.leftValue}</span>
          </div>
        )}
        {entry.rightValue !== null && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 9, textTransform: 'uppercase' }}>right: </span>
            <span style={{ color: 'var(--success)', wordBreak: 'break-all' }}>{entry.rightValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared components ────────────────────────────────────────────────────────

function ToolBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 16px', borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-secondary)',
    }}>
      {children}
    </div>
  )
}

function ActionBtn({ onClick, loading, children }: { onClick: () => void; loading: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: '6px 16px', fontSize: 12, fontWeight: 600,
      background: 'var(--accent)', color: '#000', borderRadius: 6,
      opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s',
    }}>
      {loading ? 'Processing...' : children}
    </button>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} style={{
      padding: '6px 12px', fontSize: 11, color: copied ? 'var(--success)' : 'var(--text-muted)',
      border: '1px solid var(--border)', borderRadius: 6,
    }}>
      {copied ? 'Copied!' : 'Copy output'}
    </button>
  )
}

function PasteBtn({ onPaste }: { onPaste: (text: string) => void }) {
  const paste = async () => {
    const text = await navigator.clipboard.readText()
    onPaste(text)
  }
  return (
    <button onClick={paste} style={{
      padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)',
      border: '1px solid var(--border)', borderRadius: 6,
    }}>
      Paste
    </button>
  )
}

function SwapBtn({ onSwap }: { onSwap: () => void }) {
  return (
    <button onClick={onSwap} title="Swap left/right" style={{
      padding: '6px 10px', fontSize: 12, color: 'var(--text-muted)',
      border: '1px solid var(--border)', borderRadius: 6,
      marginLeft: 'auto',
    }}>
      ⇄ Swap
    </button>
  )
}

function ErrorBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '8px 16px', fontSize: 12,
      background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)',
      color: 'var(--danger)',
    }}>
      {children}
    </div>
  )
}

interface EditorPaneProps {
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  placeholder: string
  label: string
  onDrop?: (text: string) => void
  onKeyDown?: (e: React.KeyboardEvent) => void
}

function EditorPane({ value, onChange, readOnly, placeholder, label, onDrop, onKeyDown }: EditorPaneProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!onDrop) return
    const file = e.dataTransfer.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => onDrop(reader.result as string)
      reader.readAsText(file)
    } else {
      const text = e.dataTransfer.getData('text')
      if (text) onDrop(text)
    }
  }

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
        background: dragOver ? 'rgba(245,158,11,0.04)' : 'var(--bg)',
        transition: 'background 0.15s',
      }}
      onDragOver={e => { e.preventDefault(); if (onDrop) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div style={{
        padding: '6px 14px', fontSize: 10, fontWeight: 600,
        color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.8,
        borderBottom: '1px solid var(--border)',
      }}>
        {label}
        {dragOver && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>Drop file here</span>}
      </div>
      <textarea
        value={value}
        onChange={onChange ? e => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        style={{
          flex: 1, border: 'none', borderRadius: 0, resize: 'none',
          background: 'transparent',
        }}
        spellCheck={false}
      />
    </div>
  )
}
