import { useEffect, useState } from 'react'
import { api, kafbatApi, ttydApi } from '../api/hubApi'
import type { KafbatCluster, KafbatConfig } from '../api/hubApi'
import { applyPalette, PRESETS } from '../palettes'
import type { Entry, ExportedConfig, Folder, KeybindsConfig, PaletteConfig } from '../types'
import Modal from './Modal'

interface ConfigPageProps {
  folders: Folder[]
  keybinds: KeybindsConfig
  onKeybindsChange: (k: KeybindsConfig) => void
  palette: PaletteConfig
  onPaletteChange: (p: PaletteConfig) => void
  onRefresh: () => void
}

export default function ConfigPage({ folders, keybinds, onKeybindsChange, palette, onPaletteChange, onRefresh }: ConfigPageProps) {
  const [showAddFolder, setShowAddFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [toast, setToast] = useState('')

  const [editKeybinds, setEditKeybinds] = useState<KeybindsConfig>(keybinds)
  useEffect(() => { setEditKeybinds(keybinds) }, [keybinds])

  const [editPalette, setEditPalette] = useState<PaletteConfig>(palette)
  useEffect(() => { setEditPalette(palette) }, [palette])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const saveKeybinds = async () => {
    const cleaned: KeybindsConfig = {
      ...editKeybinds,
      entryShortcuts: editKeybinds.entryShortcuts.filter(s => s.entryId > 0 && s.shortcut.trim().length > 0),
    }
    const updated = await api.updateConfig({ keybinds: cleaned })
    onKeybindsChange(updated.keybinds)
    showToast('Keybinds saved')
  }

  const previewPalette = (p: PaletteConfig) => {
    setEditPalette(p)
    applyPalette(p)
  }

  const savePalette = async () => {
    const updated = await api.updateConfig({ palette: editPalette })
    onPaletteChange(updated.palette ?? editPalette)
    showToast('Theme saved')
  }

  const addFolder = async () => {
    if (!newFolderName.trim()) return
    await api.createFolder(newFolderName.trim())
    setNewFolderName('')
    setShowAddFolder(false)
    onRefresh()
  }

  const deleteFolder = async (id: number) => {
    if (!confirm('Delete this folder? Entries inside will become unorganised.')) return
    await api.deleteFolder(id)
    onRefresh()
  }

  const deleteEntry = async (id: number) => {
    if (!confirm('Delete this entry?')) return
    await api.deleteEntry(id)
    onRefresh()
  }

  const exportConfig = async () => {
    const data = await api.exportConfig()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hub-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importConfig = async (file: File) => {
    const text = await file.text()
    const data: ExportedConfig = JSON.parse(text)
    await api.importConfig(data)
    if (data.config.palette) {
      onPaletteChange(data.config.palette)
    }
    showToast('Config imported')
    onRefresh()
  }

  const exportDb = async () => {
    try {
      const sql = await api.exportDb()
      const blob = new Blob([sql], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `hub-db-${new Date().toISOString().slice(0, 10)}.sql`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Database exported')
    } catch (e) {
      showToast('Export failed: ' + (e as Error).message)
    }
  }

  const importDb = async (file: File) => {
    try {
      const sql = await file.text()
      await api.importDb(sql)
      showToast('Database imported — refreshing…')
      onRefresh()
    } catch (e) {
      showToast('Import failed: ' + (e as Error).message)
    }
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 2000,
            background: '#0f2e1a', border: '1px solid #2a6a3a',
            borderRadius: 8, padding: '10px 16px', color: '#6ee89a',
            fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            ✓ {toast}
          </div>
        )}

        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 28, letterSpacing: -0.3 }}>
          Configuration
        </h1>

        {/* Folders & Entries */}
        <Section
          title="Entries"
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              <GhostBtn onClick={() => setShowAddFolder(true)}>New folder</GhostBtn>
              <PrimaryBtn onClick={() => setShowAddEntry(true)}>+ Add entry</PrimaryBtn>
            </div>
          }
        >
          {folders.length === 0 && (
            <EmptyState>No folders yet. Create one to get started.</EmptyState>
          )}
          {folders.map(folder => (
            <div key={folder.id} style={{ marginBottom: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 12px', background: 'rgba(255,255,255,0.03)',
                borderRadius: folder.entries.length > 0 ? '8px 8px 0 0' : 8,
                border: '1px solid var(--border)',
                borderBottom: folder.entries.length > 0 ? 'none' : undefined,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {folder.name}
                </span>
                <DangerBtn onClick={() => deleteFolder(folder.id)}>Delete</DangerBtn>
              </div>
              {folder.entries.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                  {folder.entries.map((entry, i) => (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                      background: 'var(--card-bg)',
                    }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{entry.label}</span>
                      <Badge>{entry.type}</Badge>
                      {entry.type === 'tui' ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.command ?? ''}
                        </span>
                      ) : entry.url && (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {entry.url}
                        </span>
                      )}
                      <TextBtn onClick={() => setEditEntry(entry)}>Edit</TextBtn>
                      <DangerBtn onClick={() => deleteEntry(entry.id)}>Remove</DangerBtn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Section>

        {/* Appearance / Palette */}
        <Section title="Appearance">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <SectionLabel>Color theme</SectionLabel>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => previewPalette({ preset: key })}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: '12px 16px',
                      background: editPalette.preset === key ? 'var(--active-bg)' : 'rgba(255,255,255,0.03)',
                      border: `2px solid ${editPalette.preset === key ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: preset.accent,
                      boxShadow: editPalette.preset === key ? `0 0 14px ${preset.accent}99` : 'none',
                      transition: 'box-shadow 0.15s',
                    }} />
                    <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>{preset.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => previewPalette({ ...editPalette, preset: 'custom' })}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '12px 16px',
                    background: editPalette.preset === 'custom' ? 'var(--active-bg)' : 'rgba(255,255,255,0.03)',
                    border: `2px solid ${editPalette.preset === 'custom' ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, #a78bfa, #38bdf8, #4ade80, #fb923c, #a3a3a3, #a78bfa)',
                  }} />
                  <span style={{ fontSize: 11, color: 'var(--text)', fontWeight: 500 }}>Custom</span>
                </button>
              </div>
            </div>

            {editPalette.preset === 'custom' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Primary accent">
                  <input
                    type="color"
                    value={editPalette.customAccent ?? '#a78bfa'}
                    onChange={e => previewPalette({ ...editPalette, customAccent: e.target.value })}
                    style={{ height: 38, padding: '2px 4px', cursor: 'pointer' }}
                  />
                </Field>
                <Field label="Secondary accent">
                  <input
                    type="color"
                    value={editPalette.customAccent2 ?? '#818cf8'}
                    onChange={e => previewPalette({ ...editPalette, customAccent2: e.target.value })}
                    style={{ height: 38, padding: '2px 4px', cursor: 'pointer' }}
                  />
                </Field>
                <Field label="Background">
                  <input
                    type="color"
                    value={editPalette.customBg ?? '#0e0c15'}
                    onChange={e => previewPalette({ ...editPalette, customBg: e.target.value })}
                    style={{ height: 38, padding: '2px 4px', cursor: 'pointer' }}
                  />
                </Field>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryBtn onClick={savePalette}>Save theme</PrimaryBtn>
            </div>
          </div>
        </Section>

        {/* Module Configuration */}
        <ModuleConfigSection showToast={showToast} />

        {/* Keybinds */}
        <Section title="Keyboard Shortcuts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div>
              <SectionLabel>Global actions</SectionLabel>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Click a field then press the key (or combo) you want. Works with modifiers: <Mono>ctrl+k</Mono>, <Mono>alt+1</Mono>, etc.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Go home / focus sidebar">
                  <KeyInput value={editKeybinds.goHome} onChange={v => setEditKeybinds(k => ({ ...k, goHome: v }))} />
                </Field>
                <Field label="Focus search">
                  <KeyInput value={editKeybinds.focusSearch} onChange={v => setEditKeybinds(k => ({ ...k, focusSearch: v }))} />
                </Field>
                <Field label="Navigate up">
                  <KeyInput value={editKeybinds.navUp} onChange={v => setEditKeybinds(k => ({ ...k, navUp: v }))} />
                </Field>
                <Field label="Navigate down">
                  <KeyInput value={editKeybinds.navDown} onChange={v => setEditKeybinds(k => ({ ...k, navDown: v }))} />
                </Field>
                <Field label="Open settings">
                  <KeyInput value={editKeybinds.openSettings} onChange={v => setEditKeybinds(k => ({ ...k, openSettings: v }))} />
                </Field>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <SectionLabel>Quick slots 1–9</SectionLabel>
              <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Map digit keys to specific entries. Unassigned slots fall back to the entry's position in the list.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[1,2,3,4,5,6,7,8,9].map(n => {
                  const digit = String(n)
                  const current = editKeybinds.entryShortcuts.find(s => s.shortcut === digit)
                  const allEntries = folders.flatMap(f => f.entries)
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <kbd style={{
                        fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
                        color: 'var(--accent)', background: 'var(--accent-glow)',
                        border: '1px solid rgba(167,139,250,0.3)', borderRadius: 5,
                        padding: '3px 7px', flexShrink: 0,
                      }}>{n}</kbd>
                      <select
                        value={current?.entryId ?? ''}
                        onChange={e => {
                          const val = e.target.value ? Number(e.target.value) : null
                          setEditKeybinds(k => {
                            const rest = k.entryShortcuts.filter(s => s.shortcut !== digit)
                            return { ...k, entryShortcuts: val ? [...rest, { entryId: val, shortcut: digit }] : rest }
                          })
                        }}
                        style={{ fontSize: 12 }}
                      >
                        <option value="">— auto (pos {n}) —</option>
                        {allEntries.map(entry => (
                          <option key={entry.id} value={entry.id}>{entry.label}</option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <SectionLabel style={{ marginBottom: 0 }}>Custom shortcuts</SectionLabel>
                <GhostBtn onClick={() => setEditKeybinds(k => ({ ...k, entryShortcuts: [...k.entryShortcuts, { entryId: 0, shortcut: '' }] }))}>+ Add</GhostBtn>
              </div>
              {editKeybinds.entryShortcuts.filter(s => !/^\d$/.test(s.shortcut)).length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No custom shortcuts yet.</p>
              )}
              {editKeybinds.entryShortcuts
                .map((es, i) => ({ es, i }))
                .filter(({ es }) => !/^\d$/.test(es.shortcut))
                .map(({ es, i }) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    <select
                      value={es.entryId || ''}
                      onChange={e => {
                        const val = Number(e.target.value)
                        setEditKeybinds(k => ({ ...k, entryShortcuts: k.entryShortcuts.map((s, j) => j === i ? { ...s, entryId: val } : s) }))
                      }}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">— pick entry —</option>
                      {folders.flatMap(f => f.entries).map(entry => (
                        <option key={entry.id} value={entry.id}>{entry.label}</option>
                      ))}
                    </select>
                    <KeyInput value={es.shortcut} onChange={v => setEditKeybinds(k => ({ ...k, entryShortcuts: k.entryShortcuts.map((s, j) => j === i ? { ...s, shortcut: v } : s) }))} />
                    <button
                      type="button"
                      onClick={() => setEditKeybinds(k => ({ ...k, entryShortcuts: k.entryShortcuts.filter((_, j) => j !== i) }))}
                      style={{ color: 'var(--danger)', fontSize: 18, lineHeight: 1 }}
                    >×</button>
                  </div>
                ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
              <PrimaryBtn onClick={saveKeybinds}>Save shortcuts</PrimaryBtn>
            </div>
          </div>
        </Section>

        {/* Backup */}
        <Section title="Backup & Restore">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <SectionLabel>Configuration (entries, folders, keybinds, theme)</SectionLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryBtn onClick={exportConfig}>Export config</PrimaryBtn>
                <label style={{ display: 'inline-block' }}>
                  <GhostBtn as="span">Import config</GhostBtn>
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importConfig(f) }} />
                </label>
              </div>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <SectionLabel>Database (full hub data including icons)</SectionLabel>
              <div style={{ display: 'flex', gap: 8 }}>
                <PrimaryBtn onClick={exportDb}>Export database</PrimaryBtn>
                <label style={{ display: 'inline-block' }}>
                  <GhostBtn as="span">Import database</GhostBtn>
                  <input type="file" accept=".sql" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) importDb(f) }} />
                </label>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                Importing a database will replace all current data. Make sure to export first as a backup.
              </p>
            </div>
          </div>
        </Section>

        {/* Backup Scheduler */}
        <BackupSchedulerSection showToast={showToast} />

      </div>

      {showAddFolder && (
        <Modal title="New folder" onClose={() => setShowAddFolder(false)}>
          <form onSubmit={e => { e.preventDefault(); addFolder() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Name">
              <input placeholder="e.g. Observability" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} autoFocus />
            </Field>
            <ModalFooter onCancel={() => setShowAddFolder(false)} submitLabel="Create" />
          </form>
        </Modal>
      )}

      {(showAddEntry || editEntry) && (
        <EntryModal
          folders={folders}
          entry={editEntry}
          onClose={() => { setShowAddEntry(false); setEditEntry(null) }}
          onSave={async () => { setShowAddEntry(false); setEditEntry(null); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{title}</h2>
        {action}
      </div>
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        {children}
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{label}</label>
      {children}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
      color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)',
      border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px',
    }}>{children}</span>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>{children}</p>
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, ...style }}>
      {children}
    </p>
  )
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>{children}</code>
}

function PrimaryBtn({ onClick, children, type = 'button' }: { onClick?: () => void; children: React.ReactNode; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} style={{
      padding: '7px 16px',
      background: 'linear-gradient(135deg, var(--accent-solid), var(--accent-2))',
      border: 'none', borderRadius: 7,
      fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      transition: 'opacity 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {children}
    </button>
  )
}

function GhostBtn({ onClick, children, as: Tag = 'button' }: { onClick?: () => void; children: React.ReactNode; as?: 'button' | 'span' }) {
  const style: React.CSSProperties = {
    padding: '7px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border-light)', borderRadius: 7,
    fontSize: 13, color: 'var(--text)', cursor: 'pointer', display: 'inline-block',
    transition: 'background 0.15s',
  }
  const handlers = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'),
  }
  if (Tag === 'span') {
    return <span onClick={onClick} style={style} {...handlers}>{children}</span>
  }
  return <button type="button" onClick={onClick} style={style} {...handlers}>{children}</button>
}

function TextBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
      {children}
    </button>
  )
}

function DangerBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
      {children}
    </button>
  )
}

function ModalFooter({ onCancel, submitLabel = 'Save' }: { onCancel: () => void; submitLabel?: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
      <GhostBtn onClick={onCancel}>Cancel</GhostBtn>
      <PrimaryBtn type="submit">{submitLabel}</PrimaryBtn>
    </div>
  )
}

// ── KeyInput ──────────────────────────────────────────────────────────────────

function KeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [capturing, setCapturing] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const parts: string[] = []
    if (e.ctrlKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey) parts.push('shift')
    if (e.metaKey) parts.push('meta')
    const k = e.key
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(k)) parts.push(k)
    if (parts.length) onChange(parts.join('+'))
    setCapturing(false)
  }

  return (
    <input
      readOnly={!capturing}
      value={capturing ? '…press a key' : value}
      onFocus={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      onKeyDown={capturing ? handleKeyDown : undefined}
      placeholder="click to set"
      style={{
        fontFamily: 'monospace', fontSize: 12,
        borderColor: capturing ? 'var(--accent)' : undefined,
        boxShadow: capturing ? '0 0 0 3px var(--accent-glow)' : undefined,
        cursor: 'pointer',
      }}
    />
  )
}

// ── Entry modal ───────────────────────────────────────────────────────────────

interface EntryModalProps {
  folders: Folder[]
  entry: Entry | null
  onClose: () => void
  onSave: () => Promise<void>
}

function EntryModal({ folders, entry, onClose, onSave }: EntryModalProps) {
  const [label, setLabel] = useState(entry?.label ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [type, setType] = useState<'redirect' | 'tui' | 'tool'>(entry?.type ?? 'redirect')
  const [folderId, setFolderId] = useState<number | undefined>(entry?.folderId)
  const [workdir, setWorkdir] = useState(entry?.workdir ?? '')
  const [command, setCommand] = useState(entry?.command ?? '')
  const [emoji, setEmoji] = useState(entry?.emoji ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!label.trim()) return
    setError(null)
    setSaving(true)
    try {
      if (type === 'tui' && !entry) {
        // New TUI: spawn via ttyd-manager, get URL
        const session = await ttydApi.create(label, workdir || '/root', command)
        await api.createEntry({
          label, url: session.url, type, folderId, position: 0,
          workdir: workdir || '/root', command, emoji: emoji || undefined,
        })
      } else if (entry) {
        await api.updateEntry(entry.id, {
          label,
          url: type === 'tui' ? entry.url : (url || undefined),
          type, folderId, emoji: emoji || undefined,
          ...(type === 'tui' ? { workdir: workdir || undefined, command: command || undefined } : {}),
        })
      } else {
        await api.createEntry({ label, url: url || undefined, type, folderId, position: 0, emoji: emoji || undefined })
      }
      await onSave()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <Modal title={entry ? 'Edit entry' : 'New entry'} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); save() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {error && (
          <div style={{ padding: '8px 12px', background: '#2a0f0f', border: '1px solid #5a2020', borderRadius: 6, color: '#f87171', fontSize: 12 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
          <Field label="Label">
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="My Service" autoFocus required />
          </Field>
          <Field label="Emoji">
            <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="🔧" style={{ width: 52, textAlign: 'center', fontSize: 18 }} maxLength={4} />
          </Field>
        </div>

        {type === 'tui' ? (
          <>
            <Field label="Working directory">
              <input
                value={workdir}
                onChange={e => setWorkdir(e.target.value)}
                placeholder="/root"
              />
            </Field>
            <Field label="Command">
              <input
                value={command}
                onChange={e => setCommand(e.target.value)}
                placeholder="lazydocker"
                required
              />
            </Field>
            {entry?.url && (
              <Field label="ttyd URL (auto-assigned)">
                <input value={entry.url} readOnly style={{ opacity: 0.6 }} />
              </Field>
            )}
          </>
        ) : (
          <Field label="URL">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </Field>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Type">
            <select value={type} onChange={e => setType(e.target.value as typeof type)}>
              <option value="redirect">Redirect</option>
              <option value="tui">TUI (terminal)</option>
            </select>
          </Field>
          <Field label="Folder">
            <select value={folderId ?? ''} onChange={e => setFolderId(e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">No folder</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
        </div>
        <ModalFooter onCancel={onClose} submitLabel={saving ? 'Saving…' : entry ? 'Save changes' : 'Add entry'} />
      </form>
    </Modal>
  )
}

// ── Module Configuration ─────────────────────────────────────────────────────

function ModuleConfigSection({ showToast }: { showToast: (msg: string) => void }) {
  const [kafbat, setKafbat] = useState<KafbatConfig | null>(null)
  const [clusters, setClusters] = useState<KafbatCluster[]>([])
  const [newClusterName, setNewClusterName] = useState('')
  const [newClusterBrokers, setNewClusterBrokers] = useState('')
  const [editingCluster, setEditingCluster] = useState<KafbatCluster | null>(null)

  useEffect(() => {
    kafbatApi.getConfig().then(setKafbat).catch(() => {})
    kafbatApi.getClusters().then(setClusters).catch(() => {})
  }, [])

  const saveKafbat = async () => {
    if (!kafbat) return
    try {
      await kafbatApi.updateConfig(kafbat)
      showToast('Kafbat+ config saved')
    } catch {
      showToast('Failed to save Kafbat+ config')
    }
  }

  const addCluster = async () => {
    if (!newClusterName.trim() || !newClusterBrokers.trim()) return
    try {
      const created = await kafbatApi.createCluster(newClusterName.trim(), newClusterBrokers.trim())
      setClusters(prev => [...prev, created])
      setNewClusterName('')
      setNewClusterBrokers('')
      showToast('Cluster added')
    } catch {
      showToast('Failed to add cluster')
    }
  }

  const saveCluster = async () => {
    if (!editingCluster) return
    try {
      const updated = await kafbatApi.updateCluster(editingCluster.id, editingCluster.name, editingCluster.brokers)
      setClusters(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditingCluster(null)
      showToast('Cluster updated')
    } catch {
      showToast('Failed to update cluster')
    }
  }

  const removeCluster = async (id: number) => {
    if (!confirm('Delete this cluster?')) return
    try {
      await kafbatApi.deleteCluster(id)
      setClusters(prev => prev.filter(c => c.id !== id))
      showToast('Cluster deleted')
    } catch {
      showToast('Cannot delete default cluster')
    }
  }

  if (!kafbat) return null

  return (
    <Section title="Module Configuration">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SectionLabel>Kafbat+</SectionLabel>

        {/* Clusters */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Kafka Clusters</span>
          </div>
          {clusters.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>No clusters configured.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clusters.map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}>
                {editingCluster?.id === c.id ? (
                  <>
                    <input
                      value={editingCluster.name}
                      onChange={e => setEditingCluster({ ...editingCluster, name: e.target.value })}
                      style={{ flex: '0 0 140px', fontSize: 12 }}
                      placeholder="Name"
                    />
                    <input
                      value={editingCluster.brokers}
                      onChange={e => setEditingCluster({ ...editingCluster, brokers: e.target.value })}
                      style={{ flex: 1, fontSize: 12 }}
                      placeholder="Brokers"
                    />
                    <TextBtn onClick={saveCluster}>Save</TextBtn>
                    <TextBtn onClick={() => setEditingCluster(null)}>Cancel</TextBtn>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', minWidth: 100 }}>{c.name}</span>
                    {c.isDefault && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                        color: '#6366f1', background: 'rgba(99,102,241,0.1)',
                        padding: '2px 6px', borderRadius: 4,
                      }}>default</span>
                    )}
                    <span style={{
                      flex: 1, fontSize: 11.5, fontFamily: 'monospace',
                      color: 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{c.brokers}</span>
                    <TextBtn onClick={() => setEditingCluster({ ...c })}>Edit</TextBtn>
                    {!c.isDefault && <DangerBtn onClick={() => removeCluster(c.id)}>Delete</DangerBtn>}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add cluster */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end',
          }}>
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Cluster name</label>
              <input
                value={newClusterName}
                onChange={e => setNewClusterName(e.target.value)}
                placeholder="e.g. Production"
                style={{ fontSize: 12 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 10, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>Brokers</label>
              <input
                value={newClusterBrokers}
                onChange={e => setNewClusterBrokers(e.target.value)}
                placeholder="host:9092,host2:9092"
                style={{ fontSize: 12 }}
              />
            </div>
            <button
              onClick={addCluster}
              disabled={!newClusterName.trim() || !newClusterBrokers.trim()}
              style={{
                padding: '7px 14px', fontSize: 12, fontWeight: 500,
                background: !newClusterName.trim() || !newClusterBrokers.trim() ? 'var(--text-dim)' : '#6366f1',
                color: '#fff', borderRadius: 6, whiteSpace: 'nowrap',
                opacity: !newClusterName.trim() || !newClusterBrokers.trim() ? 0.5 : 1,
                border: 'none', cursor: 'pointer',
              }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* General config */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <Field label="Default message limit">
            <input type="number" min={1} value={kafbat.defaultLimit} onChange={e => setKafbat(c => c ? { ...c, defaultLimit: e.target.value } : c)} />
          </Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <PrimaryBtn onClick={saveKafbat}>Save</PrimaryBtn>
        </div>
      </div>
    </Section>
  )
}

// ── Backup Scheduler ─────────────────────────────────────────────────────────

function BackupSchedulerSection({ showToast }: { showToast: (msg: string) => void }) {
  const [config, setConfig] = useState<{ enabled: boolean; intervalMinutes: number; path: string; retention: number } | null>(null)
  const [backups, setBackups] = useState<{ filename: string; timestamp: string; sizeBytes: number }[]>([])
  const [running, setRunning] = useState(false)

  useEffect(() => {
    api.getBackupConfig().then(setConfig).catch(() => {})
    api.getBackups().then(setBackups).catch(() => {})
  }, [])

  const saveConfig = async () => {
    if (!config) return
    await api.updateBackupConfig(config)
    showToast('Backup schedule saved')
  }

  const runNow = async () => {
    setRunning(true)
    try {
      await api.runBackup()
      showToast('Backup created')
      const list = await api.getBackups()
      setBackups(list)
    } catch (e) {
      showToast('Backup failed: ' + (e as Error).message)
    } finally {
      setRunning(false)
    }
  }

  if (!config) return null

  return (
    <Section title="Backup Scheduler">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Backup directory">
            <input value={config.path} onChange={e => setConfig(c => c ? { ...c, path: e.target.value } : c)} />
          </Field>
          <Field label="Interval (minutes)">
            <input type="number" min={5} value={config.intervalMinutes} onChange={e => setConfig(c => c ? { ...c, intervalMinutes: Number(e.target.value) } : c)} />
          </Field>
          <Field label="Keep last N backups">
            <input type="number" min={1} value={config.retention} onChange={e => setConfig(c => c ? { ...c, retention: Number(e.target.value) } : c)} />
          </Field>
          <Field label="Auto-backup enabled">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => c ? { ...c, enabled: e.target.checked } : c)} style={{ width: 'auto' }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{config.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryBtn onClick={saveConfig}>Save schedule</PrimaryBtn>
          <GhostBtn onClick={runNow}>{running ? 'Running...' : 'Run backup now'}</GhostBtn>
        </div>
        {backups.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <SectionLabel>Recent backups ({backups.length})</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {backups.slice(0, 10).map(b => (
                <div key={b.filename} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 10px', background: 'rgba(255,255,255,0.02)',
                  borderRadius: 6, fontSize: 12,
                }}>
                  <span style={{ fontFamily: 'monospace', flex: 1 }}>{b.filename}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{(b.sizeBytes / 1024).toFixed(1)} KB</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{new Date(b.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  )
}
