import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { api, type Handoff, type Decision } from './api/memoryApi'

type View = 'handoffs' | 'decisions'

const s = {
  root: { display: 'flex', height: '100%', width: '100%', overflow: 'hidden' } as CSSProperties,
  sidebar: { width: 'var(--sidebar-width)', minWidth: 280, background: 'var(--sidebar-bg)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' } as CSSProperties,
  sidebarHeader: { padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' } as CSSProperties,
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } as CSSProperties,
  content: { flex: 1, overflow: 'auto', padding: 20, maxWidth: 800 } as CSSProperties,
  tabs: { display: 'flex', gap: 0, background: 'var(--card-bg)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 } as CSSProperties,
  tab: (active: boolean) => ({ padding: '8px 18px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text-muted)', background: active ? 'var(--active-bg)' : 'transparent', cursor: 'pointer', transition: 'all 0.15s', flex: 1, textAlign: 'center' }) as CSSProperties,
  scrollList: { flex: 1, overflow: 'auto' } as CSSProperties,
  listItem: (active: boolean) => ({ padding: '10px 14px', cursor: 'pointer', background: active ? 'var(--active-bg)' : 'transparent', borderLeft: active ? '3px solid var(--accent)' : '3px solid transparent', transition: 'all 0.12s' }) as CSSProperties,
  card: { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 16 } as CSSProperties,
  label: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 500 } as CSSProperties,
  btn: { padding: '8px 18px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as CSSProperties,
  btnOutline: { padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' } as CSSProperties,
  btnDanger: { padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' } as CSSProperties,
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent)', marginRight: 6 } as CSSProperties,
  mono: { fontFamily: 'var(--mono)', fontSize: 13 } as CSSProperties,
  meta: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 } as CSSProperties,
  empty: { padding: 40, textAlign: 'center', color: 'var(--text-muted)' } as CSSProperties,
  row: { display: 'flex', gap: 12, marginBottom: 12 } as CSSProperties,
}

export default function App() {
  const [view, setView] = useState<View>('handoffs')
  const [search, setSearch] = useState('')

  // Handoffs
  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [selectedHandoff, setSelectedHandoff] = useState<Handoff | null>(null)
  const [handoffHistory, setHandoffHistory] = useState<Handoff[]>([])
  const [showHandoffForm, setShowHandoffForm] = useState(false)
  const [handoffForm, setHandoffForm] = useState({ project: '', context: 'default', content: '', tool: '' })

  // Decisions
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null)
  const [showDecisionForm, setShowDecisionForm] = useState(false)
  const [editingDecision, setEditingDecision] = useState<Decision | null>(null)
  const [decisionForm, setDecisionForm] = useState({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' })
  const [tags, setTags] = useState<string[]>([])
  const [filterTag, setFilterTag] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [projects, setProjects] = useState<string[]>([])

  const loadHandoffs = useCallback(() => {
    api.getHandoffs().then(setHandoffs).catch(() => {})
  }, [])

  const loadDecisions = useCallback(() => {
    api.getDecisions(search || undefined, filterTag || undefined, filterProject || undefined)
      .then(setDecisions).catch(() => {})
  }, [search, filterTag, filterProject])

  useEffect(() => {
    loadHandoffs()
    loadDecisions()
    api.getTags().then(setTags).catch(() => {})
    api.getProjects().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => { loadDecisions() }, [search, filterTag, filterProject, loadDecisions])

  const selectHandoff = useCallback((h: Handoff) => {
    setSelectedHandoff(h)
    api.getHandoffHistory(h.project, h.context).then(setHandoffHistory).catch(() => setHandoffHistory([]))
  }, [])

  const saveHandoff = useCallback(() => {
    if (!handoffForm.project || !handoffForm.content) return
    api.writeHandoff({
      project: handoffForm.project,
      context: handoffForm.context || 'default',
      content: handoffForm.content,
      tool: handoffForm.tool || undefined,
    }).then(() => {
      setShowHandoffForm(false)
      setHandoffForm({ project: '', context: 'default', content: '', tool: '' })
      loadHandoffs()
    }).catch(() => {})
  }, [handoffForm, loadHandoffs])

  const saveDecision = useCallback(() => {
    if (!decisionForm.title || !decisionForm.description) return
    const data = {
      title: decisionForm.title,
      description: decisionForm.description,
      reasoning: decisionForm.reasoning || undefined,
      alternatives: decisionForm.alternatives || undefined,
      tags: decisionForm.tags || undefined,
      project: decisionForm.project || undefined,
      mrLink: decisionForm.mrLink || undefined,
      ticketLink: decisionForm.ticketLink || undefined,
    }
    const promise = editingDecision
      ? api.updateDecision(editingDecision.id, data)
      : api.createDecision(data as Decision)
    promise.then(() => {
      setShowDecisionForm(false)
      setEditingDecision(null)
      setDecisionForm({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' })
      loadDecisions()
      api.getTags().then(setTags).catch(() => {})
      api.getProjects().then(setProjects).catch(() => {})
    }).catch(() => {})
  }, [decisionForm, editingDecision, loadDecisions])

  const deleteDecision = useCallback((id: number) => {
    api.deleteDecision(id).then(() => {
      setSelectedDecision(null)
      loadDecisions()
    }).catch(() => {})
  }, [loadDecisions])

  const editDecision = useCallback((d: Decision) => {
    setEditingDecision(d)
    setDecisionForm({
      title: d.title,
      description: d.description,
      reasoning: d.reasoning || '',
      alternatives: d.alternatives || '',
      tags: d.tags || '',
      project: d.project || '',
      mrLink: d.mrLink || '',
      ticketLink: d.ticketLink || '',
    })
    setShowDecisionForm(true)
  }, [])

  // Group handoffs by project
  const handoffsByProject = new Map<string, Handoff[]>()
  handoffs.forEach(h => {
    const list = handoffsByProject.get(h.project) || []
    list.push(h)
    handoffsByProject.set(h.project, list)
  })

  return (
    <div style={s.root}>
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>AI Memory</span>
          <div style={s.tabs}>
            <button style={s.tab(view === 'handoffs')} onClick={() => setView('handoffs')}>Handoffs</button>
            <button style={s.tab(view === 'decisions')} onClick={() => setView('decisions')}>Decisions</button>
          </div>
          {view === 'decisions' && (
            <>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decisions..." style={{ marginBottom: 8, fontSize: 12 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ fontSize: 11, padding: '4px 6px', width: 'auto', flex: 1 }}>
                  <option value="">All tags</option>
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ fontSize: 11, padding: '4px 6px', width: 'auto', flex: 1 }}>
                  <option value="">All projects</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        <div style={s.scrollList}>
          {view === 'handoffs' && (
            <>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                <button style={{ ...s.btn, width: '100%', fontSize: 12 }} onClick={() => setShowHandoffForm(true)}>+ Write Handoff</button>
              </div>
              {Array.from(handoffsByProject.entries()).map(([project, hList]) => (
                <div key={project}>
                  <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, background: 'var(--bg)' }}>
                    {project}
                  </div>
                  {hList.map(h => (
                    <div key={h.id} style={s.listItem(selectedHandoff?.id === h.id)} onClick={() => selectHandoff(h)}
                      onMouseEnter={e => { if (selectedHandoff?.id !== h.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--card-hover)' }}
                      onMouseLeave={e => { if (selectedHandoff?.id !== h.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                      <div style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.content.slice(0, 80)}</div>
                      <div style={s.meta}>
                        {h.context !== 'default' && <span style={s.badge}>{h.context}</span>}
                        {h.tool && <span style={{ ...s.badge, background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{h.tool}</span>}
                        {h.updatedAt && <span>{new Date(h.updatedAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {handoffs.length === 0 && <p style={s.empty}>No handoffs yet</p>}
            </>
          )}

          {view === 'decisions' && (
            <>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)' }}>
                <button style={{ ...s.btn, width: '100%', fontSize: 12 }} onClick={() => { setEditingDecision(null); setDecisionForm({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' }); setShowDecisionForm(true) }}>
                  + Log Decision
                </button>
              </div>
              {decisions.map(d => (
                <div key={d.id} style={s.listItem(selectedDecision?.id === d.id)} onClick={() => setSelectedDecision(d)}
                  onMouseEnter={e => { if (selectedDecision?.id !== d.id) (e.currentTarget as HTMLDivElement).style.background = 'var(--card-hover)' }}
                  onMouseLeave={e => { if (selectedDecision?.id !== d.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                  <div style={s.meta}>
                    {d.project && <span style={s.badge}>{d.project}</span>}
                    {d.tags?.split(',').filter(Boolean).map(t => <span key={t} style={{ ...s.badge, background: 'rgba(167,139,250,0.08)' }}>{t.trim()}</span>)}
                    {d.createdAt && <span>{new Date(d.createdAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
              {decisions.length === 0 && <p style={s.empty}>No decisions logged</p>}
            </>
          )}
        </div>
      </div>

      <div style={s.main}>
        <div style={s.content}>
          {/* Handoff form */}
          {showHandoffForm && (
            <div style={s.card}>
              <h2 style={{ fontSize: 16, marginBottom: 16 }}>Write Handoff</h2>
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Project *</label>
                  <input value={handoffForm.project} onChange={e => setHandoffForm({ ...handoffForm, project: e.target.value })} placeholder="e.g. dev-hub" />
                </div>
                <div style={{ width: 120 }}>
                  <label style={s.label}>Context</label>
                  <input value={handoffForm.context} onChange={e => setHandoffForm({ ...handoffForm, context: e.target.value })} placeholder="default" />
                </div>
                <div style={{ width: 120 }}>
                  <label style={s.label}>Tool</label>
                  <select value={handoffForm.tool} onChange={e => setHandoffForm({ ...handoffForm, tool: e.target.value })}>
                    <option value="">-</option>
                    <option value="claude-code">Claude Code</option>
                    <option value="opencode">OpenCode</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
              </div>
              <label style={s.label}>Content *</label>
              <textarea value={handoffForm.content} onChange={e => setHandoffForm({ ...handoffForm, content: e.target.value })} rows={10} placeholder="What was being done, what's left, pending decisions, context..." style={s.mono} />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button style={s.btnOutline} onClick={() => setShowHandoffForm(false)}>Cancel</button>
                <button style={s.btn} onClick={saveHandoff}>Save</button>
              </div>
            </div>
          )}

          {/* Decision form */}
          {showDecisionForm && (
            <div style={s.card}>
              <h2 style={{ fontSize: 16, marginBottom: 16 }}>{editingDecision ? 'Edit Decision' : 'Log Decision'}</h2>
              <label style={s.label}>Title *</label>
              <input value={decisionForm.title} onChange={e => setDecisionForm({ ...decisionForm, title: e.target.value })} placeholder="Chose X over Y" style={{ marginBottom: 12 }} />
              <label style={s.label}>Description *</label>
              <textarea value={decisionForm.description} onChange={e => setDecisionForm({ ...decisionForm, description: e.target.value })} rows={4} placeholder="What was decided and the context..." style={{ marginBottom: 12 }} />
              <label style={s.label}>Reasoning</label>
              <textarea value={decisionForm.reasoning} onChange={e => setDecisionForm({ ...decisionForm, reasoning: e.target.value })} rows={3} placeholder="Why this over alternatives..." style={{ marginBottom: 12 }} />
              <label style={s.label}>Alternatives considered</label>
              <textarea value={decisionForm.alternatives} onChange={e => setDecisionForm({ ...decisionForm, alternatives: e.target.value })} rows={2} placeholder="Other options that were considered..." style={{ marginBottom: 12 }} />
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Tags (comma-separated)</label>
                  <input value={decisionForm.tags} onChange={e => setDecisionForm({ ...decisionForm, tags: e.target.value })} placeholder="architecture, database" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Project</label>
                  <input value={decisionForm.project} onChange={e => setDecisionForm({ ...decisionForm, project: e.target.value })} placeholder="dev-hub" />
                </div>
              </div>
              <div style={s.row}>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>MR Link (future)</label>
                  <input value={decisionForm.mrLink} onChange={e => setDecisionForm({ ...decisionForm, mrLink: e.target.value })} placeholder="https://gitlab.com/..." />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={s.label}>Ticket Link (future)</label>
                  <input value={decisionForm.ticketLink} onChange={e => setDecisionForm({ ...decisionForm, ticketLink: e.target.value })} placeholder="JIRA-123" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                <button style={s.btnOutline} onClick={() => { setShowDecisionForm(false); setEditingDecision(null) }}>Cancel</button>
                <button style={s.btn} onClick={saveDecision}>Save</button>
              </div>
            </div>
          )}

          {/* Handoff detail */}
          {view === 'handoffs' && selectedHandoff && !showHandoffForm && (
            <div>
              <div style={s.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ fontSize: 16 }}>
                    <span style={s.badge}>{selectedHandoff.project}</span>
                    {selectedHandoff.context !== 'default' && <span style={s.badge}>{selectedHandoff.context}</span>}
                  </h2>
                  {selectedHandoff.tool && <span style={{ ...s.badge, background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{selectedHandoff.tool}</span>}
                </div>
                <div style={{ ...s.mono, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{selectedHandoff.content}</div>
                <div style={{ ...s.meta, marginTop: 12 }}>
                  Last updated: {selectedHandoff.updatedAt ? new Date(selectedHandoff.updatedAt).toLocaleString() : '-'}
                </div>
              </div>
              {handoffHistory.length > 1 && (
                <div style={s.card}>
                  <h3 style={{ fontSize: 14, marginBottom: 12 }}>History ({handoffHistory.length} entries)</h3>
                  {handoffHistory.map((h, i) => (
                    <div key={h.id} style={{ padding: '10px 0', borderBottom: i < handoffHistory.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={s.meta}>
                        {h.tool && <span style={{ ...s.badge, background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{h.tool}</span>}
                        {h.updatedAt && new Date(h.updatedAt).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden' }}>{h.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Decision detail */}
          {view === 'decisions' && selectedDecision && !showDecisionForm && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, flex: 1 }}>{selectedDecision.title}</h2>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button style={s.btnOutline} onClick={() => editDecision(selectedDecision)}>Edit</button>
                  <button style={s.btnDanger} onClick={() => deleteDecision(selectedDecision.id)}>Delete</button>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                {selectedDecision.project && <span style={s.badge}>{selectedDecision.project}</span>}
                {selectedDecision.tags?.split(',').filter(Boolean).map(t => <span key={t} style={{ ...s.badge, background: 'rgba(167,139,250,0.08)' }}>{t.trim()}</span>)}
                {selectedDecision.tool && <span style={{ ...s.badge, background: 'rgba(74,222,128,0.12)', color: 'var(--success)' }}>{selectedDecision.tool}</span>}
              </div>
              <label style={s.label}>Description</label>
              <div style={{ ...s.mono, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 16 }}>{selectedDecision.description}</div>
              {selectedDecision.reasoning && (
                <>
                  <label style={s.label}>Reasoning</label>
                  <div style={{ ...s.mono, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 16, color: 'var(--text-muted)' }}>{selectedDecision.reasoning}</div>
                </>
              )}
              {selectedDecision.alternatives && (
                <>
                  <label style={s.label}>Alternatives considered</label>
                  <div style={{ ...s.mono, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 16, color: 'var(--text-muted)' }}>{selectedDecision.alternatives}</div>
                </>
              )}
              {(selectedDecision.mrLink || selectedDecision.ticketLink) && (
                <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                  {selectedDecision.mrLink && <a href={selectedDecision.mrLink} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>MR Link</a>}
                  {selectedDecision.ticketLink && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ticket: {selectedDecision.ticketLink}</span>}
                </div>
              )}
              <div style={{ ...s.meta, marginTop: 16 }}>
                Created: {selectedDecision.createdAt ? new Date(selectedDecision.createdAt).toLocaleString() : '-'}
                {selectedDecision.updatedAt && ` | Updated: ${new Date(selectedDecision.updatedAt).toLocaleString()}`}
              </div>
            </div>
          )}

          {/* Empty states */}
          {view === 'handoffs' && !selectedHandoff && !showHandoffForm && <p style={s.empty}>Select a handoff from the sidebar or write a new one</p>}
          {view === 'decisions' && !selectedDecision && !showDecisionForm && <p style={s.empty}>Select a decision from the sidebar or log a new one</p>}
        </div>
      </div>
    </div>
  )
}
