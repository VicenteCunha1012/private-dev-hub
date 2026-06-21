import { useState, type RefObject } from 'react'
import type { Entry, Folder, KeybindsConfig } from '../types'
import EntryIcon from './EntryIcon'

interface HomeScreenProps {
  folders: Folder[]
  keybinds: KeybindsConfig
  searchRef: RefObject<HTMLInputElement | null>
  onSelect: (entry: Entry, reload?: boolean) => void
  onAddEntry: () => void
}

export default function HomeScreen({ folders, keybinds, searchRef, onSelect, onAddEntry }: HomeScreenProps) {
  const [search, setSearch] = useState('')

  const allEntries = folders.flatMap(f => f.entries)
  const filtered = search
    ? allEntries.filter(e => e.label.toLowerCase().includes(search.toLowerCase()))
    : allEntries

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '56px 32px 40px', overflowY: 'auto',
      background: 'radial-gradient(ellipse 70% 40% at 50% -10%, rgba(124,58,237,0.12) 0%, transparent 70%)',
    }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, margin: '0 auto 16px',
          boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
        }}>⬡</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', letterSpacing: -0.5, marginBottom: 4 }}>
          Dev Hub
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your tools, one place.</p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 380, marginBottom: 48 }}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}>
          <path d="M6.5 11a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM13 13l-3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <input
          ref={searchRef}
          type="search"
          placeholder={`Search services… (${keybinds.focusSearch})`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 36, fontSize: 14 }}
        />
      </div>

      {/* Add button */}
      <div style={{ width: '100%', maxWidth: 860, display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={onAddEntry} style={{
          padding: '7px 16px', fontSize: 12.5, fontWeight: 600, borderRadius: 7,
          background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-2))',
          color: '#fff', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ fontSize: 16 }}>+</span> Add entry
        </button>
      </div>

      {/* Grid */}
      <div style={{ width: '100%', maxWidth: 860 }}>
        {folders.map(folder => {
          const entries = search
            ? folder.entries.filter(e => e.label.toLowerCase().includes(search.toLowerCase()))
            : folder.entries
          if (entries.length === 0) return null
          return (
            <div key={folder.id} style={{ marginBottom: 36 }}>
              <h2 style={{
                fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 12,
              }}>
                {folder.name}
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: 10,
              }}>
                {entries.map(entry => (
                  <EntryCard key={entry.id} entry={entry} onSelect={onSelect} />
                ))}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && search && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 24 }}>
            No services found for "<strong>{search}</strong>"
          </p>
        )}
      </div>
    </div>
  )
}

function EntryCard({ entry, onSelect }: { entry: Entry; onSelect: (e: Entry, reload?: boolean) => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => onSelect(entry, true)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 10, padding: '18px 10px 14px',
        background: hovered ? 'var(--card-hover)' : 'var(--card-bg)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        cursor: 'pointer',
        color: 'var(--text)',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 0 0 3px var(--accent-glow)' : 'none',
      }}
    >
      <div style={{
        width: 36, height: 36,
        background: hovered ? 'rgba(167,139,250,0.1)' : 'rgba(255,255,255,0.04)',
        borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}>
        <EntryIcon entry={entry} size={20} />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 500, textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        width: '100%', color: hovered ? 'var(--active-text)' : 'var(--text)',
        transition: 'color 0.15s',
      }}>
        {entry.label}
      </span>
    </button>
  )
}
