import { forwardRef, useState } from 'react'
import type { Entry, Folder, KeybindsConfig } from '../types'
import EntryIcon from './EntryIcon'

interface SidebarProps {
  folders: Folder[]
  selectedId: number | null
  showConfig: boolean
  keybinds: KeybindsConfig
  onSelect: (entry: Entry, reload?: boolean) => void
  onConfigClick: () => void
  onGoHome: () => void
  onAddEntry: () => void
  onMoveEntry: (entryId: number, newFolderId: number | undefined, newPosition: number) => void
  onEntryContextMenu?: (e: React.MouseEvent, entry: Entry) => void
}

const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  { folders, selectedId, showConfig, keybinds, onSelect, onConfigClick, onGoHome, onAddEntry, onMoveEntry, onEntryContextMenu },
  ref
) {
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})
  const [dragEntry, setDragEntry] = useState<Entry | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<number | null>(null)

  const toggleFolder = (id: number) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))

  const collectEntries = (fs: Folder[]): Entry[] => fs.flatMap(f => [...f.entries, ...collectEntries(f.children ?? [])])
  const allEntries = collectEntries(folders)
  const shortcutMap: Record<number, string> = {}
  keybinds.entryShortcuts.forEach(s => { shortcutMap[s.entryId] = s.shortcut })
  // Fill remaining slots with default digit positions
  allEntries.forEach((entry, i) => {
    if (!shortcutMap[entry.id] && i < 9) shortcutMap[entry.id] = String(i + 1)
  })

  return (
    <nav
      ref={ref}
      tabIndex={0}
      onMouseEnter={e => {
        if (document.activeElement?.tagName === 'IFRAME') {
          (document.activeElement as HTMLElement).blur()
        }
        (e.currentTarget as HTMLElement).focus()
      }}
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* Logo + Add button */}
      <div style={{
        padding: '12px 10px 10px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <button onClick={onGoHome} style={{
          display: 'flex', alignItems: 'center', gap: 9, flex: 1,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, flexShrink: 0,
            boxShadow: '0 2px 8px rgba(124,58,237,0.4)',
          }}>⬡</div>
          <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)', letterSpacing: -0.2 }}>
            Dev Hub
          </span>
        </button>
        <button onClick={onAddEntry} title="Add entry" style={{
          width: 26, height: 26, borderRadius: 6,
          background: 'var(--accent-solid)', color: '#fff',
          fontSize: 16, fontWeight: 700, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>

      {/* Folders */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        {folders.map(folder => (
          <SidebarFolder
            key={folder.id}
            folder={folder}
            depth={0}
            collapsed={collapsed}
            toggleFolder={toggleFolder}
            selectedId={selectedId}
            showConfig={showConfig}
            shortcutMap={shortcutMap}
            dragOverFolder={dragOverFolder}
            onSelect={onSelect}
            onDragStart={setDragEntry}
            onDragOverFolder={setDragOverFolder}
            onDropEntry={(folderId, count) => {
              if (dragEntry) onMoveEntry(dragEntry.id, folderId, count)
              setDragOverFolder(null)
              setDragEntry(null)
            }}
            onEntryContextMenu={onEntryContextMenu}
          />
        ))}
      </div>

      {/* Config */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onConfigClick}
          style={{
            width: '100%', textAlign: 'left',
            padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
            color: showConfig ? 'var(--active-text)' : 'var(--text-muted)',
            background: showConfig ? 'var(--active-bg)' : undefined,
            borderRadius: 6,
            fontSize: 13, fontWeight: 500,
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => { if (!showConfig) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { if (!showConfig) (e.currentTarget as HTMLButtonElement).style.background = '' }}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 9.5a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M12.5 7.5h-.5M3 7.5h-.5M7.5 2.5v-.5M7.5 13v-.5M10.7 4.3l-.35.35M4.65 10.35l-.35.35M10.7 10.7l-.35-.35M4.65 4.65l-.35-.35" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Settings
        </button>
      </div>
    </nav>
  )
})

export default Sidebar

interface SidebarFolderProps {
  folder: Folder
  depth: number
  collapsed: Record<number, boolean>
  toggleFolder: (id: number) => void
  selectedId: number | null
  showConfig: boolean
  shortcutMap: Record<number, string>
  dragOverFolder: number | null
  onSelect: (entry: Entry, reload?: boolean) => void
  onDragStart: (entry: Entry) => void
  onDragOverFolder: (id: number) => void
  onDropEntry: (folderId: number, count: number) => void
  onEntryContextMenu?: (e: React.MouseEvent, entry: Entry) => void
}

function SidebarFolder({
  folder, depth, collapsed, toggleFolder, selectedId, showConfig,
  shortcutMap, dragOverFolder, onSelect, onDragStart, onDragOverFolder, onDropEntry, onEntryContextMenu,
}: SidebarFolderProps) {
  return (
    <div
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); onDragOverFolder(folder.id) }}
      onDragLeave={() => onDragOverFolder(-1)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropEntry(folder.id, folder.entries.length) }}
      style={{
        borderRadius: 6,
        background: dragOverFolder === folder.id ? 'var(--accent-glow)' : undefined,
        transition: 'background 0.15s',
        marginBottom: 2,
        marginLeft: depth > 0 ? 10 : 0,
      }}
    >
      <button
        onClick={() => toggleFolder(folder.id)}
        style={{
          width: '100%', textAlign: 'left',
          padding: '5px 8px',
          display: 'flex', alignItems: 'center', gap: 5,
          color: 'var(--text-muted)',
          fontSize: depth > 0 ? 10 : 10.5, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: 1,
          borderRadius: 5,
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{ transition: 'transform 0.15s', transform: collapsed[folder.id] ? 'rotate(-90deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
        {folder.name}
      </button>

      {!collapsed[folder.id] && (
        <>
          {folder.entries.map(entry => (
            <SidebarEntry
              key={entry.id}
              entry={entry}
              selected={selectedId === entry.id && !showConfig}
              shortcut={shortcutMap[entry.id]}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onContextMenu={onEntryContextMenu}
            />
          ))}
          {(folder.children ?? []).map(child => (
            <SidebarFolder
              key={child.id}
              folder={child}
              depth={depth + 1}
              collapsed={collapsed}
              toggleFolder={toggleFolder}
              selectedId={selectedId}
              showConfig={showConfig}
              shortcutMap={shortcutMap}
              dragOverFolder={dragOverFolder}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOverFolder={onDragOverFolder}
              onDropEntry={onDropEntry}
              onEntryContextMenu={onEntryContextMenu}
            />
          ))}
        </>
      )}
    </div>
  )
}

interface SidebarEntryProps {
  entry: Entry
  selected: boolean
  shortcut?: string
  onSelect: (entry: Entry, reload?: boolean) => void
  onDragStart: (entry: Entry) => void
  onContextMenu?: (e: React.MouseEvent, entry: Entry) => void
}

function SidebarEntry({ entry, selected, shortcut, onSelect, onDragStart, onContextMenu }: SidebarEntryProps) {
  return (
    <button
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/entry-id', String(entry.id)); onDragStart(entry) }}
      onClick={() => onSelect(entry, selected)}
      onContextMenu={onContextMenu ? e => { e.preventDefault(); onContextMenu(e, entry) } : undefined}
      style={{
        width: '100%', textAlign: 'left',
        padding: '6px 10px 6px 20px',
        display: 'flex', alignItems: 'center', gap: 7,
        color: selected ? 'var(--active-text)' : 'var(--text)',
        background: selected ? 'var(--active-bg)' : undefined,
        borderRadius: 6,
        fontSize: 13, fontWeight: selected ? 500 : 400,
        transition: 'background 0.1s, color 0.1s',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = '' }}
    >
      {selected && (
        <span style={{
          position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
          width: 2.5, height: 14, background: 'var(--accent)',
          borderRadius: 2, flexShrink: 0,
        }} />
      )}
      <EntryIcon entry={entry} size={15} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {entry.label}
      </span>
      {shortcut && (
        <kbd style={{
          fontSize: 10, fontFamily: 'monospace',
          color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--border)', borderRadius: 3,
          padding: '1px 4px', flexShrink: 0, lineHeight: 1.5,
        }}>
          {shortcut}
        </kbd>
      )}
    </button>
  )
}
