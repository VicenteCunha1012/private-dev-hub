import { useState, useEffect, useCallback } from 'react'

const MEM_BASE = 'http://localhost:10417'

async function mReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${MEM_BASE}${path}`, opts)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
function mPost<T>(path: string, body: unknown): Promise<T> {
  return mReq(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function mPut<T>(path: string, body: unknown): Promise<T> {
  return mReq(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function mDel<T>(path: string): Promise<T> {
  return mReq(path, { method: 'DELETE' })
}

interface Handoff {
  id: number; project: string; context: string; content: string
  tool?: string; createdAt?: string; updatedAt?: string
}

interface Decision {
  id: number; title: string; description: string
  reasoning?: string; alternatives?: string; tags?: string
  project?: string; mrLink?: string; ticketLink?: string
  tool?: string; createdAt?: string; updatedAt?: string
}

const memApi = {
  getHandoffs: () => mReq<Handoff[]>('/handoffs'),
  getHandoffHistory: (project: string, context = 'default') =>
    mReq<Handoff[]>(`/handoffs/history?project=${encodeURIComponent(project)}&context=${encodeURIComponent(context)}&limit=20`),
  writeHandoff: (data: { project: string; context?: string; content: string; tool?: string }) =>
    mPost<Handoff>('/handoffs', data),
  getDecisions: (search?: string, tag?: string, project?: string) => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (tag) p.set('tag', tag)
    if (project) p.set('project', project)
    const qs = p.toString()
    return mReq<Decision[]>(`/decisions${qs ? `?${qs}` : ''}`)
  },
  createDecision: (data: Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>) => mPost<Decision>('/decisions', data),
  updateDecision: (id: number, data: Partial<Decision>) => mPut<Decision>(`/decisions/${id}`, data),
  deleteDecision: (id: number) => mDel<{ status: string }>(`/decisions/${id}`),
  getTags: () => mReq<string[]>('/decisions/tags'),
  getProjects: () => mReq<string[]>('/decisions/projects'),
}

const v = '#8b5cf6'
const bd = 'rgba(255,255,255,0.08)'

const btn = {
  padding: '7px 16px', borderRadius: 6, background: v, color: '#fff',
  fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
}
const btnO = {
  padding: '6px 12px', borderRadius: 6, border: `1px solid ${bd}`,
  color: '#94a3b8', fontSize: 12, cursor: 'pointer', background: 'transparent',
}
const btnD = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(248,113,113,0.4)',
  color: '#f87171', fontSize: 12, cursor: 'pointer', background: 'transparent',
}
const label = { fontSize: 11, color: '#64748b', marginBottom: 5, display: 'block', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 0.5 }
const card = { background: 'rgba(255,255,255,0.03)', border: `1px solid ${bd}`, borderRadius: 10, padding: 20, marginBottom: 14 }
const badge = { display: 'inline-block', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(139,92,246,0.15)', color: v, marginRight: 5 }
const meta = { fontSize: 11, color: '#475569', marginTop: 4 }

type SubView = 'handoffs' | 'decisions'

export default function AiMemoryView() {
  const [sub, setSub] = useState<SubView>('handoffs')
  const [search, setSearch] = useState('')

  const [handoffs, setHandoffs] = useState<Handoff[]>([])
  const [selHandoff, setSelHandoff] = useState<Handoff | null>(null)
  const [handoffHistory, setHandoffHistory] = useState<Handoff[]>([])
  const [showHForm, setShowHForm] = useState(false)
  const [hForm, setHForm] = useState({ project: '', context: 'default', content: '', tool: '' })

  const [decisions, setDecisions] = useState<Decision[]>([])
  const [selDecision, setSelDecision] = useState<Decision | null>(null)
  const [showDForm, setShowDForm] = useState(false)
  const [editingD, setEditingD] = useState<Decision | null>(null)
  const [dForm, setDForm] = useState({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' })
  const [tags, setTags] = useState<string[]>([])
  const [filterTag, setFilterTag] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [projects, setProjects] = useState<string[]>([])

  const loadHandoffs = useCallback(() => { memApi.getHandoffs().then(setHandoffs).catch(() => {}) }, [])
  const loadDecisions = useCallback(() => {
    memApi.getDecisions(search || undefined, filterTag || undefined, filterProject || undefined)
      .then(setDecisions).catch(() => {})
  }, [search, filterTag, filterProject])

  useEffect(() => {
    loadHandoffs(); loadDecisions()
    memApi.getTags().then(setTags).catch(() => {})
    memApi.getProjects().then(setProjects).catch(() => {})
  }, [])

  useEffect(() => { loadDecisions() }, [search, filterTag, filterProject, loadDecisions])

  const selectHandoff = (h: Handoff) => {
    setSelHandoff(h)
    memApi.getHandoffHistory(h.project, h.context).then(setHandoffHistory).catch(() => setHandoffHistory([]))
  }

  const saveHandoff = () => {
    if (!hForm.project || !hForm.content) return
    memApi.writeHandoff({ project: hForm.project, context: hForm.context || 'default', content: hForm.content, tool: hForm.tool || undefined })
      .then(() => { setShowHForm(false); setHForm({ project: '', context: 'default', content: '', tool: '' }); loadHandoffs() })
      .catch(() => {})
  }

  const saveDecision = () => {
    if (!dForm.title || !dForm.description) return
    const data = { title: dForm.title, description: dForm.description, reasoning: dForm.reasoning || undefined, alternatives: dForm.alternatives || undefined, tags: dForm.tags || undefined, project: dForm.project || undefined, mrLink: dForm.mrLink || undefined, ticketLink: dForm.ticketLink || undefined }
    const p = editingD ? memApi.updateDecision(editingD.id, data) : memApi.createDecision(data as Decision)
    p.then(() => {
      setShowDForm(false); setEditingD(null)
      setDForm({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' })
      loadDecisions(); memApi.getTags().then(setTags).catch(() => {}); memApi.getProjects().then(setProjects).catch(() => {})
    }).catch(() => {})
  }

  const deleteDecision = (id: number) => {
    memApi.deleteDecision(id).then(() => { setSelDecision(null); loadDecisions() }).catch(() => {})
  }

  const editDecision = (d: Decision) => {
    setEditingD(d)
    setDForm({ title: d.title, description: d.description, reasoning: d.reasoning || '', alternatives: d.alternatives || '', tags: d.tags || '', project: d.project || '', mrLink: d.mrLink || '', ticketLink: d.ticketLink || '' })
    setShowDForm(true)
  }

  const handoffsByProject = new Map<string, Handoff[]>()
  handoffs.forEach(h => { const list = handoffsByProject.get(h.project) || []; list.push(h); handoffsByProject.set(h.project, list) })

  const sidebarItemStyle = (active: boolean) => ({
    padding: '9px 14px', cursor: 'pointer',
    background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
    borderLeft: `3px solid ${active ? v : 'transparent'}`,
    transition: 'all 0.12s',
  })

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 280, flexShrink: 0, background: '#0f1117', borderRight: `1px solid ${bd}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${bd}` }}>
          <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: 3 }}>
            {(['handoffs', 'decisions'] as const).map(t => (
              <button key={t} onClick={() => setSub(t)} style={{
                flex: 1, padding: '6px 8px', fontSize: 12, fontWeight: sub === t ? 600 : 400,
                borderRadius: 5, color: sub === t ? v : '#64748b',
                background: sub === t ? 'rgba(139,92,246,0.15)' : 'transparent',
                border: 'none', cursor: 'pointer', textTransform: 'capitalize',
              }}>{t}</button>
            ))}
          </div>

          {sub === 'decisions' && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search decisions…"
                style={{ fontSize: 12, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${bd}`, borderRadius: 6, color: '#e2e8f0' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: '4px 6px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${bd}`, borderRadius: 5, color: '#94a3b8' }}>
                  <option value="">All tags</option>
                  {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                  style={{ flex: 1, fontSize: 11, padding: '4px 6px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${bd}`, borderRadius: 5, color: '#94a3b8' }}>
                  <option value="">All projects</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sub === 'handoffs' && (
            <>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${bd}` }}>
                <button style={{ ...btn, width: '100%', fontSize: 12 }} onClick={() => setShowHForm(true)}>+ Write Handoff</button>
              </div>
              {Array.from(handoffsByProject.entries()).map(([project, hList]) => (
                <div key={project}>
                  <div style={{ padding: '7px 14px', fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, background: 'rgba(0,0,0,0.2)' }}>{project}</div>
                  {hList.map(h => (
                    <div key={h.id} style={sidebarItemStyle(selHandoff?.id === h.id)} onClick={() => selectHandoff(h)}>
                      <div style={{ fontSize: 12, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.content.slice(0, 80)}</div>
                      <div style={meta}>
                        {h.context !== 'default' && <span style={badge}>{h.context}</span>}
                        {h.tool && <span style={{ ...badge, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{h.tool}</span>}
                        {h.updatedAt && new Date(h.updatedAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
              {handoffs.length === 0 && <p style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>No handoffs yet</p>}
            </>
          )}

          {sub === 'decisions' && (
            <>
              <div style={{ padding: '8px 12px', borderBottom: `1px solid ${bd}` }}>
                <button style={{ ...btn, width: '100%', fontSize: 12 }} onClick={() => { setEditingD(null); setDForm({ title: '', description: '', reasoning: '', alternatives: '', tags: '', project: '', mrLink: '', ticketLink: '' }); setShowDForm(true) }}>+ Log Decision</button>
              </div>
              {decisions.map(d => (
                <div key={d.id} style={sidebarItemStyle(selDecision?.id === d.id)} onClick={() => setSelDecision(d)}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</div>
                  <div style={meta}>
                    {d.project && <span style={badge}>{d.project}</span>}
                    {d.tags?.split(',').filter(Boolean).map(t => <span key={t} style={{ ...badge, background: 'rgba(167,139,250,0.08)' }}>{t.trim()}</span>)}
                    {d.createdAt && new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
              {decisions.length === 0 && <p style={{ padding: 32, textAlign: 'center', color: '#475569', fontSize: 13 }}>No decisions logged</p>}
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, maxWidth: 820 }}>
        {/* Handoff form */}
        {showHForm && (
          <div style={card}>
            <h2 style={{ fontSize: 15, marginBottom: 14, fontWeight: 700, color: '#e2e8f0' }}>Write Handoff</h2>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>Project *</label><input value={hForm.project} onChange={e => setHForm({ ...hForm, project: e.target.value })} placeholder="e.g. dev-hub" /></div>
              <div style={{ width: 120 }}><label style={label}>Context</label><input value={hForm.context} onChange={e => setHForm({ ...hForm, context: e.target.value })} placeholder="default" /></div>
              <div style={{ width: 120 }}>
                <label style={label}>Tool</label>
                <select value={hForm.tool} onChange={e => setHForm({ ...hForm, tool: e.target.value })}>
                  <option value="">–</option>
                  <option value="claude-code">Claude Code</option>
                  <option value="opencode">OpenCode</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <label style={label}>Content *</label>
            <textarea value={hForm.content} onChange={e => setHForm({ ...hForm, content: e.target.value })} rows={10} placeholder="What was being done, what's left, pending decisions…" style={{ fontFamily: 'var(--mono, monospace)', fontSize: 13, marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnO} onClick={() => setShowHForm(false)}>Cancel</button>
              <button style={btn} onClick={saveHandoff}>Save</button>
            </div>
          </div>
        )}

        {/* Decision form */}
        {showDForm && (
          <div style={card}>
            <h2 style={{ fontSize: 15, marginBottom: 14, fontWeight: 700, color: '#e2e8f0' }}>{editingD ? 'Edit Decision' : 'Log Decision'}</h2>
            <label style={label}>Title *</label>
            <input value={dForm.title} onChange={e => setDForm({ ...dForm, title: e.target.value })} placeholder="Chose X over Y" style={{ marginBottom: 12 }} />
            <label style={label}>Description *</label>
            <textarea value={dForm.description} onChange={e => setDForm({ ...dForm, description: e.target.value })} rows={4} placeholder="What was decided and the context…" style={{ marginBottom: 12 }} />
            <label style={label}>Reasoning</label>
            <textarea value={dForm.reasoning} onChange={e => setDForm({ ...dForm, reasoning: e.target.value })} rows={3} placeholder="Why this over alternatives…" style={{ marginBottom: 12 }} />
            <label style={label}>Alternatives considered</label>
            <textarea value={dForm.alternatives} onChange={e => setDForm({ ...dForm, alternatives: e.target.value })} rows={2} placeholder="Other options that were considered…" style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1 }}><label style={label}>Tags (comma-separated)</label><input value={dForm.tags} onChange={e => setDForm({ ...dForm, tags: e.target.value })} placeholder="architecture, database" /></div>
              <div style={{ flex: 1 }}><label style={label}>Project</label><input value={dForm.project} onChange={e => setDForm({ ...dForm, project: e.target.value })} placeholder="dev-hub" /></div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}><label style={label}>MR Link</label><input value={dForm.mrLink} onChange={e => setDForm({ ...dForm, mrLink: e.target.value })} placeholder="https://gitlab.com/…" /></div>
              <div style={{ flex: 1 }}><label style={label}>Ticket</label><input value={dForm.ticketLink} onChange={e => setDForm({ ...dForm, ticketLink: e.target.value })} placeholder="JIRA-123" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnO} onClick={() => { setShowDForm(false); setEditingD(null) }}>Cancel</button>
              <button style={btn} onClick={saveDecision}>Save</button>
            </div>
          </div>
        )}

        {/* Handoff detail */}
        {sub === 'handoffs' && selHandoff && !showHForm && (
          <div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={badge}>{selHandoff.project}</span>
                  {selHandoff.context !== 'default' && <span style={badge}>{selHandoff.context}</span>}
                </div>
                {selHandoff.tool && <span style={{ ...badge, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{selHandoff.tool}</span>}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, color: '#cbd5e1' }}>{selHandoff.content}</div>
              <div style={{ ...meta, marginTop: 12 }}>Last updated: {selHandoff.updatedAt ? new Date(selHandoff.updatedAt).toLocaleString() : '–'}</div>
            </div>
            {handoffHistory.length > 1 && (
              <div style={card}>
                <h3 style={{ fontSize: 13, marginBottom: 12, fontWeight: 600, color: '#94a3b8' }}>History ({handoffHistory.length} entries)</h3>
                {handoffHistory.map((h, i) => (
                  <div key={h.id} style={{ padding: '10px 0', borderBottom: i < handoffHistory.length - 1 ? `1px solid ${bd}` : 'none' }}>
                    <div style={meta}>{h.tool && <span style={{ ...badge, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{h.tool}</span>}{h.updatedAt && new Date(h.updatedAt).toLocaleString()}</div>
                    <div style={{ fontSize: 12, marginTop: 6, whiteSpace: 'pre-wrap', maxHeight: 100, overflow: 'hidden', color: '#94a3b8' }}>{h.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Decision detail */}
        {sub === 'decisions' && selDecision && !showDForm && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, flex: 1, fontWeight: 700, color: '#e2e8f0' }}>{selDecision.title}</h2>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button style={btnO} onClick={() => editDecision(selDecision)}>Edit</button>
                <button style={btnD} onClick={() => deleteDecision(selDecision.id)}>Delete</button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              {selDecision.project && <span style={badge}>{selDecision.project}</span>}
              {selDecision.tags?.split(',').filter(Boolean).map(t => <span key={t} style={{ ...badge, background: 'rgba(167,139,250,0.08)' }}>{t.trim()}</span>)}
              {selDecision.tool && <span style={{ ...badge, background: 'rgba(52,211,153,0.12)', color: '#34d399' }}>{selDecision.tool}</span>}
            </div>
            <label style={label}>Description</label>
            <div style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 14, color: '#cbd5e1' }}>{selDecision.description}</div>
            {selDecision.reasoning && <>
              <label style={label}>Reasoning</label>
              <div style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 14, color: '#94a3b8' }}>{selDecision.reasoning}</div>
            </>}
            {selDecision.alternatives && <>
              <label style={label}>Alternatives considered</label>
              <div style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 14, color: '#94a3b8' }}>{selDecision.alternatives}</div>
            </>}
            <div style={{ ...meta, marginTop: 14 }}>
              Created: {selDecision.createdAt ? new Date(selDecision.createdAt).toLocaleString() : '–'}
              {selDecision.updatedAt && ` | Updated: ${new Date(selDecision.updatedAt).toLocaleString()}`}
            </div>
          </div>
        )}

        {/* Empty states */}
        {sub === 'handoffs' && !selHandoff && !showHForm && <p style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Select a handoff or write a new one</p>}
        {sub === 'decisions' && !selDecision && !showDForm && <p style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Select a decision or log a new one</p>}
      </div>
    </div>
  )
}
