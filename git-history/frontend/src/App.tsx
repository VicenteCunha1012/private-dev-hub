import { useState, useEffect, useCallback, useRef } from 'react'
import { api, type RepoInfo, type BranchInfo, type CommitInfo, type CommitDetail, type TreeEntry, type FileContent, type BlameEntry, type LineHistoryEntry, type DiffFile, type DiffHunk, type DiffLine } from './api/gitApi'

type Mode = 'commits' | 'files' | 'trace'

export default function App() {
  const [repos, setRepos] = useState<RepoInfo[]>([])
  const [repo, setRepo] = useState<string>('')
  const [branches, setBranches] = useState<BranchInfo[]>([])
  const [branch, setBranch] = useState('HEAD')
  const [mode, setMode] = useState<Mode>('commits')
  const [showConfig, setShowConfig] = useState(false)
  const [configDirs, setConfigDirs] = useState<string[]>([])
  const [error, setError] = useState('')

  // Commits mode
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [selectedCommit, setSelectedCommit] = useState<string>('')
  const [commitDetail, setCommitDetail] = useState<CommitDetail | null>(null)
  const [commitOffset, setCommitOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  // Files mode
  const [tree, setTree] = useState<TreeEntry[]>([])
  const [treePath, setTreePath] = useState('')
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [fileHistory, setFileHistory] = useState<CommitInfo[]>([])
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [fileHistoryCommit, setFileHistoryCommit] = useState<CommitDetail | null>(null)

  // Trace mode (blame + line history)
  const [blameData, setBlameData] = useState<BlameEntry[]>([])
  const [lineHistory, setLineHistory] = useState<LineHistoryEntry[]>([])
  const [showLineHistory, setShowLineHistory] = useState(false)
  const [lineHistoryLoading, setLineHistoryLoading] = useState(false)
  const [traceLimit, setTraceLimit] = useState(20)

  const sidebarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.getConfig().then(cfg => {
      const dirs = (cfg.directories || '').split(',').filter(Boolean)
      setConfigDirs(dirs)
    }).catch(() => {})
    api.getRepos().then(r => {
      setRepos(r)
      if (r.length > 0) setRepo(r[0].path)
    }).catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!repo) return
    setBranches([])
    setBranch('HEAD')
    api.getBranches(repo).then(b => {
      setBranches(b)
      const current = b.find(br => br.current)
      if (current) setBranch(current.name)
    }).catch(() => {})
  }, [repo])

  useEffect(() => {
    if (!repo || !branch) return
    if (mode === 'commits') {
      setCommitOffset(0)
      setSelectedCommit('')
      setCommitDetail(null)
      api.getCommits(repo, branch, 50, 0).then(setCommits).catch(() => {})
    } else if (mode === 'files') {
      setTreePath('')
      setFileContent(null)
      setSelectedLines(new Set())
      setBlameData([])
      setLineHistory([])
      setShowLineHistory(false)
      api.getTree(repo, branch).then(setTree).catch(() => {})
    }
  }, [repo, branch, mode])

  const loadMoreCommits = useCallback(() => {
    if (loadingMore) return
    setLoadingMore(true)
    const newOffset = commitOffset + 50
    api.getCommits(repo, branch, 50, newOffset).then(more => {
      setCommits(prev => [...prev, ...more])
      setCommitOffset(newOffset)
    }).finally(() => setLoadingMore(false))
  }, [repo, branch, commitOffset, loadingMore])

  const selectCommit = useCallback((hash: string) => {
    setSelectedCommit(hash)
    api.getCommitDetail(repo, hash).then(setCommitDetail).catch(() => {})
  }, [repo])

  const navigateTree = useCallback((entry: TreeEntry) => {
    const fullPath = treePath ? `${treePath}/${entry.path}` : entry.path
    if (entry.type === 'tree') {
      setTreePath(fullPath)
      setFileContent(null)
      setSelectedLines(new Set())
      setBlameData([])
      setLineHistory([])
      setShowLineHistory(false)
      setShowFileHistory(false)
      api.getTree(repo, branch, fullPath).then(setTree).catch(() => {})
    } else {
      api.getFile(repo, fullPath, branch).then(fc => {
        setFileContent(fc)
        setSelectedLines(new Set())
        setBlameData([])
        setLineHistory([])
        setShowLineHistory(false)
      }).catch(() => {})
    }
  }, [repo, branch, treePath])

  const navigateBreadcrumb = useCallback((idx: number) => {
    const parts = treePath.split('/')
    const newPath = parts.slice(0, idx).join('/')
    setTreePath(newPath)
    setFileContent(null)
    setSelectedLines(new Set())
    setBlameData([])
    api.getTree(repo, branch, newPath).then(setTree).catch(() => {})
  }, [repo, branch, treePath])

  const handleLineClick = useCallback((lineNum: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectionStart !== null) {
      const start = Math.min(selectionStart, lineNum)
      const end = Math.max(selectionStart, lineNum)
      const newSel = new Set<number>()
      for (let i = start; i <= end; i++) newSel.add(i)
      setSelectedLines(newSel)
    } else {
      setSelectedLines(new Set([lineNum]))
      setSelectionStart(lineNum)
    }
  }, [selectionStart])

  const loadBlame = useCallback(() => {
    if (selectedLines.size === 0 || !fileContent) return
    const sorted = Array.from(selectedLines).sort((a, b) => a - b)
    const start = sorted[0]
    const end = sorted[sorted.length - 1]
    api.getBlame(repo, fileContent.path, start, end, branch)
      .then(setBlameData).catch(() => {})
    setShowLineHistory(false)
    setLineHistory([])
    setMode('trace')
  }, [repo, branch, fileContent, selectedLines])

  const loadLineHistory = useCallback(() => {
    if (selectedLines.size === 0 || !fileContent) return
    const sorted = Array.from(selectedLines).sort((a, b) => a - b)
    const start = sorted[0]
    const end = sorted[sorted.length - 1]
    setLineHistoryLoading(true)
    api.getLineHistory(repo, fileContent.path, start, end, traceLimit)
      .then(lh => { setLineHistory(lh); setShowLineHistory(true) })
      .catch(() => {})
      .finally(() => setLineHistoryLoading(false))
  }, [repo, fileContent, selectedLines, traceLimit])

  const loadFileHistory = useCallback(() => {
    if (!fileContent) return
    api.getFileHistory(repo, fileContent.path, branch)
      .then(h => { setFileHistory(h); setShowFileHistory(true) })
      .catch(() => {})
  }, [repo, branch, fileContent])

  const saveConfig = useCallback(() => {
    api.setConfig({ directories: configDirs.filter(Boolean) }).then(() => {
      api.getRepos().then(r => {
        setRepos(r)
        if (r.length > 0 && !repo) setRepo(r[0].path)
      })
      setShowConfig(false)
    }).catch(e => setError(e.message))
  }, [configDirs, repo])

  if (showConfig) {
    return (
      <div className="gh-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, margin: 16, width: 500, maxWidth: '90%' }}>
          <h2 style={{ marginBottom: 16, fontSize: 18 }}>Git History Config</h2>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>Repository directories (one per line)</label>
          <textarea
            value={configDirs.join('\n')}
            onChange={e => setConfigDirs(e.target.value.split('\n'))}
            rows={6}
            style={{ fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 12 }}
            placeholder="/home/user/projects/repo1&#10;/home/user/projects/repo2"
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowConfig(false)}>Cancel</button>
            <button className="button" onClick={saveConfig}>Save</button>
          </div>
        </div>
      </div>
    )
  }

  if (repos.length === 0) {
    return (
      <div className="gh-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, margin: 16, width: 500, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#128218;</div>
          <h2 style={{ marginBottom: 8 }}>No repositories configured</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Add repository directories to get started.</p>
          <button className="button" onClick={() => setShowConfig(true)}>Configure Repos</button>
          {error && <p style={{ color: 'var(--danger)', marginTop: 12, fontSize: 12 }}>{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="gh-root">
      {/* Sidebar */}
      <div className="gh-sidebar" ref={sidebarRef}>
        <div className="gh-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Git History</span>
            <button style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setShowConfig(true)}>Config</button>
          </div>
          <select value={repo} onChange={e => setRepo(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            {repos.map(r => <option key={r.path} value={r.path}>{r.name}</option>)}
          </select>
          <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%' }}>
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}{b.current ? ' *' : ''}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 0, background: 'var(--card-bg)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['commits', 'files', 'trace'] as Mode[]).map(m => (
            <button key={m} className={`gh-tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
              {m === 'commits' ? 'Commits' : m === 'files' ? 'Files' : 'Trace'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'commits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {commits.map(c => (
                <div key={c.hash} className={`gh-commit-item ${selectedCommit === c.hash ? 'active' : ''}`} onClick={() => selectCommit(c.hash)}>
                  <div className="gh-commit-msg">
                    <span className="gh-commit-hash">{c.shortHash}</span>
                    {c.message}
                  </div>
                  <div className="gh-commit-meta">{c.author} &middot; {c.relativeDate}</div>
                </div>
              ))}
              {commits.length >= 50 && (
                <button style={{ margin: '8px 14px', width: 'auto' }} onClick={loadMoreCommits} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              )}
            </div>
          )}
          {mode === 'files' && !fileContent && (
            <div>
              {treePath && (
                <div className="gh-breadcrumb" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                  <span className="gh-breadcrumb-part" onClick={() => navigateBreadcrumb(0)}>/</span>
                  {treePath.split('/').map((part, i) => (
                    <span key={i}>
                      <span className="gh-breadcrumb-sep">/</span>
                      <span className="gh-breadcrumb-part" onClick={() => navigateBreadcrumb(i + 1)}>{part}</span>
                    </span>
                  ))}
                </div>
              )}
              {tree.map(entry => (
                <div key={entry.path} className={`gh-tree-item ${entry.type === 'tree' ? 'dir' : 'file'}`} onClick={() => navigateTree(entry)}>
                  <span>{entry.type === 'tree' ? '\u{1F4C1}' : '\u{1F4C4}'}</span>
                  <span style={{ flex: 1 }}>{entry.name}</span>
                  {entry.size != null && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{formatSize(entry.size)}</span>}
                </div>
              ))}
            </div>
          )}
          {mode === 'files' && fileContent && (
            <div>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <button style={{ padding: '3px 8px', fontSize: 11, marginRight: 8 }} onClick={() => { setFileContent(null); setSelectedLines(new Set()); setBlameData([]) }}>
                  Back
                </button>
                <button style={{ padding: '3px 8px', fontSize: 11, marginRight: 8 }} onClick={loadFileHistory}>
                  History
                </button>
                {selectedLines.size > 0 && (
                  <button className="button" style={{ padding: '3px 8px', fontSize: 11 }} onClick={loadBlame}>
                    Blame L{Math.min(...selectedLines)}{selectedLines.size > 1 ? `-L${Math.max(...selectedLines)}` : ''}
                  </button>
                )}
              </div>
            </div>
          )}
          {(mode === 'trace') && (
            <div style={{ padding: '8px 12px' }}>
              {selectedLines.size > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Lines {Math.min(...selectedLines)}-{Math.max(...selectedLines)} of {fileContent?.path}
                </div>
              )}
              {blameData.length > 0 && !showLineHistory && (
                <button className="button" style={{ width: '100%', marginBottom: 8, fontSize: 12 }} onClick={loadLineHistory} disabled={lineHistoryLoading}>
                  {lineHistoryLoading ? 'Loading...' : 'Full line history'}
                </button>
              )}
              {selectedLines.size === 0 && (
                <p className="gh-empty" style={{ padding: 20 }}>Select lines in a file to trace their history</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="gh-main">
        {error && (
          <div style={{ padding: '8px 16px', background: 'var(--remove-bg)', color: 'var(--danger)', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
            {error}
            <button style={{ marginLeft: 12, color: 'var(--danger)', textDecoration: 'underline', fontSize: 11 }} onClick={() => setError('')}>dismiss</button>
          </div>
        )}

        {mode === 'commits' && !commitDetail && (
          <div className="gh-empty">Select a commit from the sidebar</div>
        )}

        {mode === 'commits' && commitDetail && (
          <div className="gh-content">
            <CommitDetailView detail={commitDetail} />
          </div>
        )}

        {(mode === 'files' || mode === 'trace') && fileContent && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {showFileHistory ? (
                <FileHistoryView
                  history={fileHistory}
                  onSelect={(hash) => {
                    api.getCommitDetail(repo, hash).then(d => setFileHistoryCommit(d)).catch(() => {})
                  }}
                  selectedCommit={fileHistoryCommit}
                  onClose={() => { setShowFileHistory(false); setFileHistoryCommit(null) }}
                />
              ) : (
                <FileViewer
                  file={fileContent}
                  selectedLines={selectedLines}
                  blameData={blameData}
                  onLineClick={handleLineClick}
                />
              )}
            </div>
            {mode === 'trace' && (blameData.length > 0 || showLineHistory) && (
              <div className={`gh-blame-panel ${showLineHistory ? 'wide' : 'narrow'}`}>
                <div className="gh-blame-header">
                  {showLineHistory ? 'Line History' : 'Blame'}
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {!showLineHistory && blameData.map((b, i) => (
                    <div key={i} className="gh-blame-entry">
                      <div><span className="gh-commit-hash">{b.shortHash}</span> <span style={{ fontWeight: 600 }}>{b.author}</span></div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{b.relativeDate}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4, color: 'var(--text)', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.line}</div>
                    </div>
                  ))}
                  {showLineHistory && lineHistory.map((lh, i) => (
                    <LineHistoryCard key={i} entry={lh} />
                  ))}
                  {showLineHistory && lineHistory.length >= traceLimit && (
                    <div style={{ padding: 12, textAlign: 'center' }}>
                      <button className="button" onClick={() => { setTraceLimit(prev => prev + 20); loadLineHistory() }}>
                        Go deeper
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'files' && !fileContent && (
          <div className="gh-empty">Browse the file tree and select a file</div>
        )}
      </div>
    </div>
  )
}

function CommitDetailView({ detail }: { detail: CommitDetail }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', background: 'var(--accent-glow)', padding: '2px 8px', borderRadius: 4 }}>{detail.shortHash}</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(detail.date)}</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{detail.message}</h2>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{detail.author} &lt;{detail.authorEmail}&gt;</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{detail.files.length} file{detail.files.length !== 1 ? 's' : ''} changed</div>
      {detail.files.map((file, i) => (
        <DiffFileView key={i} file={file} />
      ))}
    </div>
  )
}

function LineHistoryCard({ entry }: { entry: LineHistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const initials = entry.author.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  const hue = entry.author.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  const avatarColor = `hsl(${hue}, 45%, 38%)`
  const diffLines = entry.diff ? entry.diff.split('\n') : []
  const hasDiff = diffLines.some(l => l.startsWith('+') || l.startsWith('-'))
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0, letterSpacing: 0.5 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{entry.author}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.relativeDate}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>{entry.message}</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: hasDiff ? 8 : 0 }}>{entry.shortHash}</div>
          {hasDiff && (
            <>
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', marginBottom: expanded ? 8 : 0 }}
              >
                {expanded ? '▲ hide changes' : '▼ show changes'}
              </button>
              {expanded && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', overflow: 'auto' }}>
                  {diffLines.map((line, j) => (
                    <div key={j} style={{
                      padding: '0 8px',
                      color: line.startsWith('+') ? 'var(--add-text)' : line.startsWith('-') ? 'var(--remove-text)' : 'var(--text-muted)',
                      background: line.startsWith('+') ? 'var(--add-bg)' : line.startsWith('-') ? 'var(--remove-bg)' : 'transparent',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>{line || ' '}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DiffFileView({ file }: { file: DiffFile }) {
  const [collapsed, setCollapsed] = useState(false)
  const statusColor = file.status === 'added' ? 'green' : file.status === 'deleted' ? 'red' : 'orange'
  const badgeStyle = {
    display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: statusColor === 'green' ? 'var(--add-bg)' : statusColor === 'red' ? 'var(--remove-bg)' : 'var(--accent-glow)',
    color: statusColor === 'green' ? 'var(--add-text)' : statusColor === 'red' ? 'var(--remove-text)' : 'var(--accent)'
  }
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={badgeStyle}>{file.status}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{file.path}</span>
        </div>
        <button style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && file.hunks.map((hunk, j) => (
        <HunkView key={j} hunk={hunk} />
      ))}
    </div>
  )
}

function HunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <div>
      <div style={{ padding: '4px 14px', background: 'rgba(249, 115, 22, 0.06)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
        {hunk.header}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6 }}>
        <tbody>
          {hunk.lines.map((line, k) => (
            <DiffLineRow key={k} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const lineNumStyle = { width: 50, textAlign: 'right' as const, padding: '0 8px', color: 'var(--text-dim)', userSelect: 'none' as const, verticalAlign: 'top' as const }
  return (
    <tr>
      <td style={lineNumStyle}>{line.oldLineNum ?? ''}</td>
      <td style={lineNumStyle}>{line.newLineNum ?? ''}</td>
      <td className={`gh-diff-${line.type}`} style={{ padding: '0 12px', whiteSpace: 'pre' }}>
        <span style={{ userSelect: 'none', color: 'var(--text-dim)', marginRight: 4 }}>
          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
        </span>
        {line.content}
      </td>
    </tr>
  )
}

function FileViewer({ file, selectedLines, blameData, onLineClick }: {
  file: FileContent
  selectedLines: Set<number>
  blameData: BlameEntry[]
  onLineClick: (line: number, e: React.MouseEvent) => void
}) {
  const lines = file.content.split('\n')
  const blameMap = new Map<number, BlameEntry>()
  blameData.forEach(b => {
    for (let i = b.lineStart; i <= b.lineEnd; i++) blameMap.set(i, b)
  })

  const hashColors = new Map<string, string>()
  const colors = ['rgba(249,115,22,0.08)', 'rgba(139,92,246,0.08)', 'rgba(59,130,246,0.08)', 'rgba(16,185,129,0.08)', 'rgba(236,72,153,0.08)']
  let colorIdx = 0
  blameData.forEach(b => {
    if (!hashColors.has(b.hash)) {
      hashColors.set(b.hash, colors[colorIdx % colors.length])
      colorIdx++
    }
  })

  return (
    <div style={{ padding: 0 }}>
      <div className="gh-file-header">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{file.path}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{file.lines} lines</span>
      </div>
      <div>
        {lines.map((line, i) => {
          const lineNum = i + 1
          const blame = blameMap.get(lineNum)
          const blameColor = blame ? hashColors.get(blame.hash) : undefined
          const isSelected = selectedLines.has(lineNum)
          return (
            <div
              key={i}
              className={`gh-code-line${isSelected ? ' selected' : ''}`}
              style={!isSelected && blameColor ? { background: blameColor } : undefined}
              onClick={e => onLineClick(lineNum, e)}
            >
              <div className="gh-line-num">{lineNum}</div>
              <div className="gh-line-content">{line}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FileHistoryView({ history, onSelect, selectedCommit, onClose }: {
  history: CommitInfo[]
  onSelect: (hash: string) => void
  selectedCommit: CommitDetail | null
  onClose: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600 }}>File History ({history.length} commits)</span>
        <button style={{ padding: '3px 8px', fontSize: 11 }} onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 300, overflow: 'auto', borderRight: '1px solid var(--border)' }}>
          {history.map(c => (
            <div
              key={c.hash}
              className={`gh-commit-item ${selectedCommit?.hash === c.hash ? 'active' : ''}`}
              style={{ padding: '8px 12px' }}
              onClick={() => onSelect(c.hash)}
            >
              <div style={{ fontSize: 12 }}>
                <span className="gh-commit-hash">{c.shortHash}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.message}</span>
              </div>
              <div className="gh-commit-meta">{c.author} &middot; {c.relativeDate}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {selectedCommit ? <CommitDetailView detail={selectedCommit} /> : (
            <div className="gh-empty">Select a commit to see the diff</div>
          )}
        </div>
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch { return iso }
}
