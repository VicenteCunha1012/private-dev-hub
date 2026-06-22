import { useCallback, useEffect, useRef, useState } from 'react'
import type { Entry } from '../types'
import EntryIcon from './EntryIcon'

interface SpotlightResult {
  id: string
  label: string
  category: string
  icon: string
  data?: unknown
}

interface SpotlightProps {
  entries: Entry[]
  onSelect: (result: SpotlightResult) => void
  onClose: () => void
}

const JSON_TOOLS: SpotlightResult[] = [
  { id: 'json-format', label: 'Format JSON', category: 'JSON Tools', icon: '{ }' },
  { id: 'json-compact', label: 'Compact JSON', category: 'JSON Tools', icon: '{ }' },
  { id: 'json-diff', label: 'Diff JSON', category: 'JSON Tools', icon: '{ }' },
]

export default function Spotlight({ entries, onSelect, onClose }: SpotlightProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotlightResult[]>([])
  const [selected, setSelected] = useState(0)
  const [allItems, setAllItems] = useState<SpotlightResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load external data on mount
  useEffect(() => {
    const items: SpotlightResult[] = []

    // Hub entries
    entries.forEach(e => {
      items.push({ id: `entry-${e.id}`, label: e.label, category: 'Services', icon: '⬡', data: e })
    })

    // JSON tools
    items.push(...JSON_TOOLS)

    setAllItems(items)
    setResults(items.slice(0, 12))

    // Fetch async sources
    Promise.allSettled([
      fetch('http://localhost:10401/topics').then(r => r.json()),
      fetch('http://localhost:10409/snippets').then(r => r.json()),
      fetch('http://localhost:10408/specs').then(r => r.json()),
    ]).then(([topicsRes, snippetsRes, specsRes]) => {
      const extra: SpotlightResult[] = []

      if (topicsRes.status === 'fulfilled' && Array.isArray(topicsRes.value)) {
        topicsRes.value.forEach((t: { name: string }) => {
          extra.push({ id: `topic-${t.name}`, label: t.name, category: 'Kafka Topics', icon: '⚡', data: t })
        })
      }

      if (snippetsRes.status === 'fulfilled' && Array.isArray(snippetsRes.value)) {
        snippetsRes.value.forEach((s: { id: number; title: string; command: string }) => {
          extra.push({ id: `cmd-${s.id}`, label: s.title, category: 'Commands', icon: '>', data: s })
        })
      }

      if (specsRes.status === 'fulfilled' && Array.isArray(specsRes.value)) {
        specsRes.value.forEach((s: { id: number; name: string }) => {
          extra.push({ id: `spec-${s.id}`, label: s.name, category: 'Specs', icon: '◈', data: s })
        })
      }

      setAllItems(prev => {
        const all = [...prev, ...extra]
        setResults(all.slice(0, 12))
        return all
      })
    })

    setTimeout(() => inputRef.current?.focus(), 50)
  }, [entries])

  // Filter on query change
  useEffect(() => {
    if (!query.trim()) {
      setResults(allItems.slice(0, 12))
      setSelected(0)
      return
    }
    const q = query.toLowerCase()
    const filtered = allItems.filter(item =>
      item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    )
    setResults(filtered.slice(0, 12))
    setSelected(0)
  }, [query, allItems])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter' && results[selected]) { e.preventDefault(); onSelect(results[selected]); return }
  }, [results, selected, onClose, onSelect])

  const categoryColor = (cat: string) => {
    switch (cat) {
      case 'Services': return '#8b5cf6'
      case 'Kafka Topics': return '#f59e0b'
      case 'Commands': return '#10b981'
      case 'JSON Tools': return '#3b82f6'
      case 'Specs': return '#ec4899'
      default: return '#64748b'
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', zIndex: 2000, backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: 560, background: '#1a1d2e',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(139,92,246,0.1)',
        }}
      >
        {/* Search input */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none" style={{ color: '#8b5cf6', flexShrink: 0 }}>
            <path d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM13 13l-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search services, topics, commands..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 15, fontWeight: 400,
            }}
          />
          <kbd style={{
            fontSize: 10, color: '#475569', background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4,
            padding: '2px 6px', fontFamily: 'monospace',
          }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '4px 0' }}>
          {results.length === 0 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', color: '#475569', fontSize: 13 }}>
              No results for "{query}"
            </div>
          )}
          {results.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelected(idx)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                background: idx === selected ? 'rgba(139,92,246,0.12)' : 'transparent',
                color: idx === selected ? '#e2e8f0' : '#94a3b8',
                cursor: 'pointer', transition: 'background 0.05s',
              }}
            >
              {item.id.startsWith('entry-') ? (
                <div style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <EntryIcon entry={item.data as Entry} size={16} />
                </div>
              ) : (
                <span style={{
                  width: 22, height: 22, borderRadius: 5,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                  background: `${categoryColor(item.category)}20`,
                  color: categoryColor(item.category),
                }}>
                  {item.icon}
                </span>
              )}
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.label}
              </span>
              <span style={{
                fontSize: 10, color: categoryColor(item.category), fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0,
              }}>
                {item.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
