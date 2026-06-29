import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { ApplyConfigStatus, ApplyConfigResult, ApplyConfigFileEntry } from '../api/sessionsApi'
import { sessionsApi } from '../api/sessionsApi'

const accent = '#8b5cf6'
const border = 'rgba(255,255,255,0.08)'
const cardBg = '#1e2330'
const textMuted = '#64748b'
const textDim = '#94a3b8'

const s = {
  root: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } as CSSProperties,
  scrollArea: { flex: 1, overflow: 'auto', padding: 20 } as CSSProperties,
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 } as CSSProperties,
  card: { background: cardBg, border: `1px solid ${border}`, borderRadius: 10, padding: 16 } as CSSProperties,
  cardTitle: { fontSize: 12, fontWeight: 600, color: textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 12 },
  statusDot: (ok: boolean) => ({ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: ok ? '#22c55e' : '#ef4444', marginRight: 6 } as CSSProperties),
  btnRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginTop: 4 },
  btn: (color: string, disabled?: boolean) => ({
    padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    background: disabled ? 'rgba(255,255,255,0.06)' : color, color: disabled ? textMuted : '#fff',
    opacity: disabled ? 0.6 : 1, border: 'none', transition: 'opacity 0.15s',
  } as CSSProperties),
  output: { background: '#0d1117', border: `1px solid ${border}`, borderRadius: 8, padding: 14, fontFamily: 'var(--mono, monospace)', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 280, marginTop: 12 } as CSSProperties,
  fileList: { display: 'flex', flexDirection: 'column', gap: 0, maxHeight: 300, overflowY: 'auto', border: `1px solid ${border}`, borderRadius: 8, marginTop: 8 } as CSSProperties,
  fileItem: (active: boolean) => ({ padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: active ? 'rgba(139,92,246,0.12)' : 'transparent', borderBottom: `1px solid ${border}`, fontSize: 12 } as CSSProperties),
  fileContent: { background: '#0d1117', border: `1px solid ${border}`, borderRadius: 8, padding: 14, fontFamily: 'var(--mono, monospace)', fontSize: 12, color: '#e2e8f0', whiteSpace: 'pre-wrap', overflowY: 'auto', maxHeight: 400, marginTop: 8 } as CSSProperties,
  tag: (ok: boolean) => ({ display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: ok ? '#22c55e' : '#ef4444' } as CSSProperties),
  infoRow: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: textDim, marginBottom: 6 } as CSSProperties,
  mono: { fontFamily: 'var(--mono, monospace)', fontSize: 11 } as CSSProperties,
}

export default function ApplyConfigView() {
  const [status, setStatus] = useState<ApplyConfigStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [result, setResult] = useState<ApplyConfigResult | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<Record<string, string>>({})
  const [loadingFile, setLoadingFile] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [filterText, setFilterText] = useState('')

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      setStatus(await sessionsApi.getApplyConfigStatus())
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const run = async (name: string, fn: () => Promise<ApplyConfigResult>) => {
    setRunning(name)
    setResult(null)
    try {
      const r = await fn()
      setResult(r)
      loadStatus()
    } catch (e: unknown) {
      setResult({ success: false, output: e instanceof Error ? e.message : String(e), changed: [] })
    } finally {
      setRunning(null)
    }
  }

  const openFile = async (path: string) => {
    if (selectedFile === path) { setSelectedFile(null); return }
    setSelectedFile(path)
    if (!fileContent[path]) {
      setLoadingFile(true)
      try {
        const data = await sessionsApi.getApplyConfigFile(path)
        setFileContent(prev => ({ ...prev, [path]: data.content }))
      } catch {
        setFileContent(prev => ({ ...prev, [path]: '(failed to load)' }))
      } finally {
        setLoadingFile(false)
      }
    }
  }

  const filteredFiles = (status?.files ?? []).filter(f =>
    !filterText || f.path.toLowerCase().includes(filterText.toLowerCase())
  )

  const isBinary = (path: string) =>
    /\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|zip|gz|lock)$/.test(path)

  const isRunning = running !== null

  return (
    <div style={s.root}>
      <div style={s.scrollArea}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>AI Config Manager</div>
          <div style={{ fontSize: 13, color: textMuted }}>
            Sync your Claude Code + OpenCode config between this machine and the ai-config git repo.
          </div>
        </div>

        <div style={s.grid}>
          {/* Status card */}
          <div style={s.card}>
            <div style={s.cardTitle}>Repository Status</div>
            {loading ? (
              <div style={{ color: textMuted, fontSize: 13 }}>Loading…</div>
            ) : !status ? (
              <div style={{ color: '#ef4444', fontSize: 13 }}>Could not reach backend</div>
            ) : (
              <>
                <div style={s.infoRow}>
                  <span style={s.statusDot(status.isValidRepo)} />
                  <span style={s.tag(status.isValidRepo)}>{status.isValidRepo ? 'Valid Git Repo' : 'Not Found'}</span>
                </div>
                <div style={{ ...s.infoRow, ...s.mono, color: textMuted }}>{status.aiConfigPath}</div>
                {status.lastCommit && (
                  <div style={{ ...s.infoRow, fontSize: 12, color: textDim }}>{status.lastCommit}</div>
                )}
                {status.isValidRepo && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: textMuted, marginBottom: 4 }}>git status</div>
                    <div style={{ ...s.mono, fontSize: 11, color: status.gitStatus ? '#fbbf24' : '#22c55e' }}>
                      {status.gitStatus || 'clean'}
                    </div>
                  </div>
                )}
                <div style={{ marginTop: 12 }}>
                  <button onClick={loadStatus} disabled={isRunning} style={s.btn('rgba(255,255,255,0.1)', isRunning)}>
                    Refresh
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Actions card */}
          <div style={s.card}>
            <div style={s.cardTitle}>Operations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: textDim, marginBottom: 6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Sync</strong> — copy from <code style={s.mono}>~/.claude</code>, <code style={s.mono}>~/.config/opencode</code>, <code style={s.mono}>~/.config/rtk</code> into the repo
                </div>
                <button onClick={() => run('sync', sessionsApi.syncConfig)} disabled={isRunning} style={s.btn('#6366f1', isRunning)}>
                  {running === 'sync' ? 'Syncing…' : '↑ Sync to Repo'}
                </button>
              </div>
              <div>
                <div style={{ fontSize: 12, color: textDim, marginBottom: 6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Apply</strong> — copy from repo into system config dirs
                </div>
                <button onClick={() => run('apply', sessionsApi.applyConfig)} disabled={isRunning} style={s.btn('#059669', isRunning)}>
                  {running === 'apply' ? 'Applying…' : '↓ Apply from Repo'}
                </button>
              </div>
              <div>
                <div style={{ fontSize: 12, color: textDim, marginBottom: 6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Pull</strong> — git pull from remote
                </div>
                <button onClick={() => run('pull', sessionsApi.pullConfig)} disabled={isRunning} style={s.btn('#0284c7', isRunning)}>
                  {running === 'pull' ? 'Pulling…' : '↓ Pull from Remote'}
                </button>
              </div>
              <div>
                <div style={{ fontSize: 12, color: textDim, marginBottom: 6 }}>
                  <strong style={{ color: '#e2e8f0' }}>Push</strong> — sync + commit + git push
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={pushMsg}
                    onChange={e => setPushMsg(e.target.value)}
                    placeholder="Commit message (optional)"
                    disabled={isRunning}
                    style={{ flex: 1, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: 6, color: '#e2e8f0', fontSize: 12 }}
                  />
                  <button onClick={() => run('push', () => sessionsApi.pushConfig(pushMsg || undefined))} disabled={isRunning} style={s.btn(accent, isRunning)}>
                    {running === 'push' ? 'Pushing…' : '↑ Push to Remote'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Result output */}
        {result && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={s.cardTitle}>Result</div>
              <span style={s.tag(result.success)}>{result.success ? 'Success' : 'Failed'}</span>
            </div>
            {result.changed.length > 0 && (
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 8 }}>
                {result.changed.length} file(s) changed
              </div>
            )}
            <div style={s.output}>{result.output}</div>
            <button onClick={() => setResult(null)} style={{ ...s.btn('rgba(255,255,255,0.06)'), marginTop: 10, fontSize: 11 }}>
              Dismiss
            </button>
          </div>
        )}

        {/* File browser */}
        {status?.isValidRepo && (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={s.cardTitle}>Repo Files ({status.files.length})</div>
              <input
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                placeholder="Filter…"
                style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: 6, color: '#e2e8f0', fontSize: 12, width: 180 }}
              />
            </div>
            <div style={s.fileList}>
              {filteredFiles.map((f: ApplyConfigFileEntry) => (
                <div
                  key={f.path}
                  onClick={() => !isBinary(f.path) && openFile(f.path)}
                  style={s.fileItem(selectedFile === f.path)}
                >
                  <span style={{ ...s.mono, color: isBinary(f.path) ? textMuted : '#e2e8f0' }}>{f.path}</span>
                  <span style={{ fontSize: 11, color: textMuted }}>{(f.size / 1024).toFixed(1)}k</span>
                </div>
              ))}
              {filteredFiles.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', color: textMuted, fontSize: 13 }}>No files</div>
              )}
            </div>

            {selectedFile && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: textMuted, marginBottom: 6, ...s.mono }}>{selectedFile}</div>
                {loadingFile ? (
                  <div style={{ color: textMuted, fontSize: 13 }}>Loading…</div>
                ) : (
                  <div style={s.fileContent}>{fileContent[selectedFile] ?? ''}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Host symlink */}
        <div style={{ ...s.card, marginTop: 0 }}>
          <div style={s.cardTitle}>Host Symlink</div>
          <div style={{ fontSize: 12, color: textDim, marginBottom: 10 }}>
            Creates <code style={s.mono}>~/.config/opencode/command → ~/.claude/commands</code> on the host via ttyd-manager.
            Required so OpenCode shares Claude Code's commands directory. Safe to re-run.
          </div>
          <button
            onClick={() => run('hostSetup', sessionsApi.hostSetup)}
            disabled={isRunning}
            style={s.btn('#d97706', isRunning)}
          >
            {running === 'hostSetup' ? 'Running…' : 'Create Host Symlink'}
          </button>
        </div>

      </div>
    </div>
  )
}
