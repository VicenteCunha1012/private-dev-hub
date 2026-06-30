import { useState, useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { api, type RegexResponse, type CronResponse, type UrlParseResponse, type JwtDecodeResponse } from './api/utilsApi'

// ── Nav ───────────────────────────────────────────────────────────────────────

type Page =
  | 'regex' | 'cron' | 'uuid' | 'hash' | 'url' | 'jwt'
  | 'format' | 'compact' | 'diff'
  | 'ports' | 'services'
  | 'git'

const SECTIONS = [
  {
    key: 'utils', label: 'Dev Utils',
    items: [
      { key: 'regex' as Page, label: 'Regex Workbench', icon: '.*' },
      { key: 'cron' as Page, label: 'Cron / systemd', icon: '⏱' },
      { key: 'uuid' as Page, label: 'UUID / ULID', icon: '#' },
      { key: 'hash' as Page, label: 'Hash & Checksum', icon: '∑' },
      { key: 'url' as Page, label: 'URL Parser', icon: '🔗' },
      { key: 'jwt' as Page, label: 'JWT Decoder', icon: '🔑' },
    ],
  },
  {
    key: 'json', label: 'JSON Tools',
    items: [
      { key: 'format' as Page, label: 'Format', icon: '{ }' },
      { key: 'compact' as Page, label: 'Compact', icon: '▸' },
      { key: 'diff' as Page, label: 'Diff', icon: '⇄' },
    ],
  },
  {
    key: 'infra', label: 'Infra Monitor',
    items: [
      { key: 'ports' as Page, label: 'Port Radar', icon: '📡' },
      { key: 'services' as Page, label: 'Health Dashboard', icon: '💚' },
    ],
  },
  {
    key: 'git', label: 'Git History',
    items: [
      { key: 'git' as Page, label: 'Git History', icon: '📜' },
    ],
  },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: { height: '100%', display: 'flex', overflow: 'hidden', fontFamily: 'var(--font)' } as CSSProperties,

  sidebar: {
    width: 220, flexShrink: 0,
    background: 'var(--s1)', borderRight: '1px solid var(--bd)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  } as CSSProperties,

  sidebarHead: {
    padding: '18px 16px 14px',
    borderBottom: '1px solid var(--bd)',
    display: 'flex', alignItems: 'center', gap: 10,
  } as CSSProperties,

  sidebarBody: { flex: 1, overflowY: 'auto', padding: '8px 0' } as CSSProperties,

  sectionHdr: {
    padding: '10px 16px 4px',
    fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    color: 'var(--tx-3)',
  } as CSSProperties,

  navItem: (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '7px 16px',
    fontSize: 13, fontWeight: active ? 600 : 400,
    color: active ? 'var(--ac)' : 'var(--tx-2)',
    background: active ? 'var(--ac-dim)' : 'transparent',
    borderLeft: `3px solid ${active ? 'var(--ac)' : 'transparent'}`,
    cursor: 'pointer',
    transition: 'all 0.12s',
    userSelect: 'none' as const,
  }) as CSSProperties,

  navIcon: {
    width: 20, textAlign: 'center' as const,
    fontSize: 11, fontFamily: 'var(--mono)',
    color: 'inherit', opacity: 0.7, flexShrink: 0,
  } as CSSProperties,

  content: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', background: 'var(--bg)',
  } as CSSProperties,

  scrollPane: {
    flex: 1, overflow: 'auto',
    padding: 24,
  } as CSSProperties,

  // ── shared component styles ──
  card: {
    background: 'var(--s2)', border: '1px solid var(--bd)',
    borderRadius: 'var(--r-lg)', padding: 20, marginBottom: 16,
  } as CSSProperties,

  label: {
    fontSize: 11, color: 'var(--tx-3)', marginBottom: 6,
    display: 'block', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' as const,
  } as CSSProperties,

  row: { display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-end' } as CSSProperties,

  btn: {
    padding: '8px 18px', borderRadius: 'var(--r)',
    background: 'var(--ac)', color: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap' as const, flexShrink: 0, border: 'none',
  } as CSSProperties,

  btnOutline: {
    padding: '7px 14px', borderRadius: 'var(--r)',
    border: '1px solid var(--bd)', color: 'var(--tx-2)',
    fontSize: 12, cursor: 'pointer', background: 'transparent',
    whiteSpace: 'nowrap' as const,
  } as CSSProperties,

  mono: { fontFamily: 'var(--mono)', fontSize: 13 } as CSSProperties,

  result: {
    background: 'var(--bg)', border: '1px solid var(--bd)',
    borderRadius: 'var(--r)', padding: 14,
    fontFamily: 'var(--mono)', fontSize: 13,
    lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-all' as const,
  } as CSSProperties,

  badge: {
    display: 'inline-block', padding: '2px 8px',
    borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: 'var(--ac-dim)', color: 'var(--ac)', marginRight: 6,
  } as CSSProperties,

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as CSSProperties,
  th: { textAlign: 'left' as const, padding: '8px 12px', borderBottom: '1px solid var(--bd)', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 } as CSSProperties,
  td: { padding: '8px 12px', borderBottom: '1px solid var(--bd)', fontFamily: 'var(--mono)', fontSize: 12 } as CSSProperties,
  copyBtn: { padding: '2px 8px', borderRadius: 4, border: '1px solid var(--bd)', color: 'var(--tx-2)', fontSize: 11, cursor: 'pointer', marginLeft: 8, background: 'transparent' } as CSSProperties,

  errTxt: { color: 'var(--err)', fontSize: 12, marginTop: 8 } as CSSProperties,
  okTxt: { color: 'var(--ok)', fontSize: 12, marginTop: 8 } as CSSProperties,

  pageTitle: { fontSize: 17, fontWeight: 700, color: 'var(--tx)', marginBottom: 20, letterSpacing: -0.3 } as CSSProperties,
}

// ── Inline JSON API ───────────────────────────────────────────────────────────

const JSON_BASE = 'http://localhost:10406'
async function jsonReq<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${JSON_BASE}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

interface FormatResponse { result: string; valid: boolean; error: string | null }
interface DiffEntry { path: string; type: 'added' | 'removed' | 'changed'; leftValue: string | null; rightValue: string | null }
interface DiffResponse { equal: boolean; differences: DiffEntry[]; leftValid: boolean; rightValid: boolean; error: string | null }

const jsonApi = {
  format: (json: string, indent = 2) => jsonReq<FormatResponse>('/format', { json, indent }),
  compact: (json: string) => jsonReq<FormatResponse>('/compact', { json }),
  diff: (left: string, right: string) => jsonReq<DiffResponse>('/diff', { left, right }),
}

// ── Inline Infra API ──────────────────────────────────────────────────────────

const INFRA_BASE = 'http://localhost:10410'
async function infraReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${INFRA_BASE}${path}`, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

interface PortInfo { port: number; protocol: string; state: string; pid: number | null; process: string | null; isPortal: boolean; portalModule: string | null }
interface PortsResponse { ports: PortInfo[]; scannedAt: number }
interface ServiceConfig { name: string; url: string }
interface ServiceStatus { name: string; url: string; status: 'up' | 'down' | 'degraded'; responseTimeMs: number; error?: string | null }
interface StatusResponse { services: ServiceStatus[]; checkedAt: string }

const infraApi = {
  ports: () => infraReq<PortsResponse>('/ports'),
  getStatus: () => infraReq<StatusResponse>('/status'),
  getConfig: () => infraReq<ServiceConfig[]>('/config'),
  updateConfig: (s: ServiceConfig[]) => infraReq<ServiceConfig[]>('/config', { method: 'POST', body: JSON.stringify(s) }),
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>('regex')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => setCollapsed(p => ({ ...p, [key]: !p[key] }))

  const fullHeight = ['format', 'compact', 'diff', 'git'].includes(page)

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <nav style={S.sidebar}>
        <div style={S.sidebarHead}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,var(--ac),#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🧰</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--tx)', letterSpacing: -0.3 }}>Dev Hub Tools</span>
        </div>

        <div style={S.sidebarBody}>
          {SECTIONS.map(sec => (
            <div key={sec.key}>
              <div
                style={{ ...S.sectionHdr, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => toggle(sec.key)}
              >
                <span>{sec.label}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{collapsed[sec.key] ? '▸' : '▾'}</span>
              </div>
              {!collapsed[sec.key] && sec.items.map(item => (
                <div
                  key={item.key}
                  style={S.navItem(page === item.key)}
                  onClick={() => setPage(item.key)}
                  onMouseEnter={e => { if (page !== item.key) (e.currentTarget as HTMLElement).style.background = 'var(--s2)' }}
                  onMouseLeave={e => { if (page !== item.key) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <span style={S.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div style={S.content}>
        {fullHeight ? (
          // JSON tools + Git History need full height — no scroll wrapper
          <>
            {page === 'format' && <FormatTool />}
            {page === 'compact' && <CompactTool />}
            {page === 'diff' && <DiffTool />}
            {page === 'git' && <GitHistoryTool />}
          </>
        ) : (
          <div style={{ ...S.scrollPane, maxWidth: page === 'ports' || page === 'services' ? '100%' : 900 }}>
            {page === 'regex' && <RegexTool />}
            {page === 'cron' && <CronTool />}
            {page === 'uuid' && <UuidTool />}
            {page === 'hash' && <HashTool />}
            {page === 'url' && <UrlTool />}
            {page === 'jwt' && <JwtTool />}
            {page === 'ports' && <PortsTool />}
            {page === 'services' && <ServicesTool />}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Dev Utils tools
// ══════════════════════════════════════════════════════════════════════════════

function RegexTool() {
  const [pattern, setPattern] = useState('')
  const [text, setText] = useState('')
  const [flags, setFlags] = useState('')
  const [result, setResult] = useState<RegexResponse | null>(null)

  const test = useCallback(() => {
    if (!pattern) return
    api.testRegex(pattern, text, flags).then(setResult).catch(() => {})
  }, [pattern, text, flags])

  const highlighted = result?.valid && result.matches.length > 0 ? buildHighlight(text, result.matches) : null

  return (
    <div>
      <h2 style={S.pageTitle}>Regex Workbench</h2>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Pattern</label>
            <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="[a-z]+" style={S.mono} onKeyDown={e => e.key === 'Enter' && test()} />
          </div>
          <div style={{ width: 80 }}>
            <label style={S.label}>Flags</label>
            <input value={flags} onChange={e => setFlags(e.target.value)} placeholder="gim" style={S.mono} />
          </div>
          <button style={S.btn} onClick={test}>Test</button>
        </div>
        <label style={S.label}>Test text</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} style={S.mono} placeholder="Paste text to test against..." />
      </div>
      {result && (
        <div style={S.card}>
          {result.error
            ? <p style={S.errTxt}>{result.error}</p>
            : <>
                <div style={{ marginBottom: 12 }}>
                  <span style={S.badge}>{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
                </div>
                {highlighted && <div style={{ ...S.result, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: highlighted }} />}
                {result.explanation && <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 12 }}>{result.explanation}</div>}
                {result.matches.length > 0 && (
                  <table style={S.table}>
                    <thead><tr><th style={S.th}>#</th><th style={S.th}>Match</th><th style={S.th}>Position</th><th style={S.th}>Groups</th></tr></thead>
                    <tbody>
                      {result.matches.map((m, i) => (
                        <tr key={i}>
                          <td style={S.td}>{i + 1}</td>
                          <td style={S.td}>{m.match}</td>
                          <td style={S.td}>{m.start}–{m.end}</td>
                          <td style={S.td}>{m.groups.filter(g => g.index > 0).map(g => g.value).join(', ') || '–'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}

function buildHighlight(text: string, matches: { start: number; end: number }[]): string {
  const sorted = [...matches].sort((a, b) => a.start - b.start)
  let out = '', last = 0
  for (const m of sorted) {
    out += esc(text.slice(last, m.start))
    out += `<span style="background:rgba(167,139,250,0.3);border-radius:2px;padding:0 1px">${esc(text.slice(m.start, m.end))}</span>`
    last = m.end
  }
  return out + esc(text.slice(last))
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function CronTool() {
  const [expr, setExpr] = useState('')
  const [count, setCount] = useState(5)
  const [result, setResult] = useState<CronResponse | null>(null)

  const parse = useCallback(() => {
    if (!expr) return
    api.parseCron(expr, count).then(setResult).catch(() => {})
  }, [expr, count])

  return (
    <div>
      <h2 style={S.pageTitle}>Cron / systemd-timer Translator</h2>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Expression</label>
            <input value={expr} onChange={e => setExpr(e.target.value)} placeholder="*/5 * * * *  or  OnCalendar=daily" style={S.mono} onKeyDown={e => e.key === 'Enter' && parse()} />
          </div>
          <div style={{ width: 80 }}>
            <label style={S.label}>Next N</label>
            <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={20} style={S.mono} />
          </div>
          <button style={S.btn} onClick={parse}>Parse</button>
        </div>
      </div>
      {result && (
        <div style={S.card}>
          {result.error
            ? <p style={S.errTxt}>{result.error}</p>
            : <>
                {result.type && <span style={S.badge}>{result.type}</span>}
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 4 }}>{result.readable}</p>
                {result.nextExecutions.length > 0 && (
                  <>
                    <label style={S.label}>Next executions</label>
                    <div style={S.result}>{result.nextExecutions.map((e, i) => <div key={i}>{new Date(e).toLocaleString()}</div>)}</div>
                  </>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}

function UuidTool() {
  const [count, setCount] = useState(5)
  const [format, setFormat] = useState('uuid4')
  const [values, setValues] = useState<string[]>([])
  const [copied, setCopied] = useState(-1)

  const generate = useCallback(() => {
    api.generateUuid(count, format).then(r => setValues(r.values)).catch(() => {})
  }, [count, format])

  const copy = (v: string, i: number) => {
    navigator.clipboard.writeText(v); setCopied(i); setTimeout(() => setCopied(-1), 1500)
  }
  const copyAll = () => {
    navigator.clipboard.writeText(values.join('\n')); setCopied(-2); setTimeout(() => setCopied(-1), 1500)
  }

  return (
    <div>
      <h2 style={S.pageTitle}>UUID / ULID Generator</h2>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ width: 140 }}>
            <label style={S.label}>Format</label>
            <select value={format} onChange={e => setFormat(e.target.value)} style={S.mono}>
              <option value="uuid4">UUID v4</option>
              <option value="uuid4-upper">UUID v4 Upper</option>
              <option value="uuid4-no-dashes">UUID no dashes</option>
              <option value="ulid">ULID</option>
            </select>
          </div>
          <div style={{ width: 80 }}>
            <label style={S.label}>Count</label>
            <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={1000} style={S.mono} />
          </div>
          <button style={S.btn} onClick={generate}>Generate</button>
          {values.length > 0 && <button style={S.btnOutline} onClick={copyAll}>{copied === -2 ? 'Copied!' : 'Copy all'}</button>}
        </div>
      </div>
      {values.length > 0 && (
        <div style={S.card}>
          {values.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '5px 0', borderBottom: i < values.length - 1 ? '1px solid var(--bd)' : 'none' }}>
              <code style={{ ...S.mono, flex: 1 }}>{v}</code>
              <button style={S.copyBtn} onClick={() => copy(v, i)}>{copied === i ? 'Copied!' : 'Copy'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HashTool() {
  const [text, setText] = useState('')
  const [algo, setAlgo] = useState('sha256')
  const [hash, setHash] = useState('')
  const [c1, setC1] = useState('')
  const [c2, setC2] = useState('')
  const [match, setMatch] = useState<boolean | null>(null)

  const compute = useCallback(() => {
    if (!text) return
    api.computeHash(text, algo).then(r => setHash(r.hash)).catch(() => {})
  }, [text, algo])

  const compare = useCallback(() => {
    if (!c1 || !c2) return
    api.compareHashes(c1, c2).then(r => setMatch(r.match)).catch(() => {})
  }, [c1, c2])

  return (
    <div>
      <h2 style={S.pageTitle}>Hash & Checksum</h2>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ width: 140 }}>
            <label style={S.label}>Algorithm</label>
            <select value={algo} onChange={e => setAlgo(e.target.value)} style={S.mono}>
              <option value="md5">MD5</option>
              <option value="sha1">SHA-1</option>
              <option value="sha256">SHA-256</option>
              <option value="sha384">SHA-384</option>
              <option value="sha512">SHA-512</option>
            </select>
          </div>
          <button style={{ ...S.btn, alignSelf: 'flex-end' }} onClick={compute}>Compute</button>
        </div>
        <label style={S.label}>Input text</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} style={S.mono} placeholder="Enter text to hash..." />
        {hash && (
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Result</label>
            <div style={{ ...S.result, display: 'flex', alignItems: 'center' }}>
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{hash}</code>
              <button style={S.copyBtn} onClick={() => navigator.clipboard.writeText(hash)}>Copy</button>
            </div>
          </div>
        )}
      </div>
      <div style={S.card}>
        <h3 style={{ fontSize: 13, marginBottom: 12, fontWeight: 600, color: 'var(--tx-2)' }}>Compare checksums</h3>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Hash 1</label>
            <input value={c1} onChange={e => { setC1(e.target.value); setMatch(null) }} style={S.mono} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={S.label}>Hash 2</label>
            <input value={c2} onChange={e => { setC2(e.target.value); setMatch(null) }} style={S.mono} />
          </div>
          <button style={S.btn} onClick={compare}>Compare</button>
        </div>
        {match !== null && <p style={match ? S.okTxt : S.errTxt}>{match ? '✓ Match' : '✗ No match'}</p>}
      </div>
    </div>
  )
}

function UrlTool() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<UrlParseResponse | null>(null)
  const [encText, setEncText] = useState('')
  const [encResult, setEncResult] = useState('')
  const [encMode, setEncMode] = useState<'encode' | 'decode'>('encode')

  const parse = useCallback(() => {
    if (!url) return
    api.parseUrl(url).then(setResult).catch(() => {})
  }, [url])

  const encode = useCallback(() => {
    if (!encText) return
    api.encodeUrl(encText, encMode === 'decode').then(r => setEncResult(r.result)).catch(() => {})
  }, [encText, encMode])

  return (
    <div>
      <h2 style={S.pageTitle}>URL / Query Parser</h2>
      <div style={S.card}>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/path?key=value#section" style={S.mono} onKeyDown={e => e.key === 'Enter' && parse()} />
          </div>
          <button style={S.btn} onClick={parse}>Parse</button>
        </div>
      </div>
      {result?.valid && (
        <div style={S.card}>
          <table style={S.table}>
            <tbody>
              {result.scheme && <tr><td style={{ ...S.td, color: 'var(--tx-3)', width: 100 }}>Scheme</td><td style={S.td}>{result.scheme}</td></tr>}
              {result.host && <tr><td style={{ ...S.td, color: 'var(--tx-3)' }}>Host</td><td style={S.td}>{result.host}</td></tr>}
              {result.port && <tr><td style={{ ...S.td, color: 'var(--tx-3)' }}>Port</td><td style={S.td}>{result.port}</td></tr>}
              {result.path && <tr><td style={{ ...S.td, color: 'var(--tx-3)' }}>Path</td><td style={S.td}>{result.path}</td></tr>}
              {result.fragment && <tr><td style={{ ...S.td, color: 'var(--tx-3)' }}>Fragment</td><td style={S.td}>{result.fragment}</td></tr>}
            </tbody>
          </table>
          {result.queryParams.length > 0 && (
            <>
              <h4 style={{ fontSize: 11, color: 'var(--tx-3)', margin: '14px 0 8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Query Parameters</h4>
              <table style={S.table}>
                <thead><tr><th style={S.th}>Key</th><th style={S.th}>Value</th></tr></thead>
                <tbody>{result.queryParams.map((p, i) => <tr key={i}><td style={S.td}>{p.key}</td><td style={S.td}>{p.value}</td></tr>)}</tbody>
              </table>
            </>
          )}
        </div>
      )}
      {result && !result.valid && <p style={S.errTxt}>{result.error}</p>}

      <div style={S.card}>
        <h3 style={{ fontSize: 13, marginBottom: 12, fontWeight: 600, color: 'var(--tx-2)' }}>URL Encode / Decode</h3>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <input value={encText} onChange={e => setEncText(e.target.value)} placeholder="Text to encode/decode" style={S.mono} onKeyDown={e => e.key === 'Enter' && encode()} />
          </div>
          <select value={encMode} onChange={e => setEncMode(e.target.value as 'encode' | 'decode')} style={{ ...S.mono, width: 100 }}>
            <option value="encode">Encode</option>
            <option value="decode">Decode</option>
          </select>
          <button style={S.btn} onClick={encode}>Go</button>
        </div>
        {encResult && (
          <div style={{ ...S.result, marginTop: 8, display: 'flex', alignItems: 'center' }}>
            <code style={{ flex: 1 }}>{encResult}</code>
            <button style={S.copyBtn} onClick={() => navigator.clipboard.writeText(encResult)}>Copy</button>
          </div>
        )}
      </div>
    </div>
  )
}

function JwtTool() {
  const [token, setToken] = useState('')
  const [result, setResult] = useState<JwtDecodeResponse | null>(null)

  const decode = useCallback(() => {
    if (!token.trim()) return
    api.decodeJwt(token.trim()).then(setResult).catch(() => {})
  }, [token])

  const formatExpiry = (payload: Record<string, unknown>) => {
    const parts: string[] = []
    if (payload.exp) {
      const exp = new Date(Number(payload.exp) * 1000)
      parts.push(`Expires: ${exp.toLocaleString()} (${exp > new Date() ? 'valid' : 'EXPIRED'})`)
    }
    if (payload.iat) parts.push(`Issued: ${new Date(Number(payload.iat) * 1000).toLocaleString()}`)
    if (payload.nbf) parts.push(`Not before: ${new Date(Number(payload.nbf) * 1000).toLocaleString()}`)
    return parts
  }

  const extractRoles = (payload: Record<string, unknown>): string[] => {
    const roles: string[] = []
    if (payload.realm_access && typeof payload.realm_access === 'object') {
      const ra = payload.realm_access as Record<string, unknown>
      if (Array.isArray(ra.roles)) roles.push(...(ra.roles as string[]).map(r => `realm:${r}`))
    }
    if (payload.resource_access && typeof payload.resource_access === 'object') {
      for (const [client, val] of Object.entries(payload.resource_access as Record<string, unknown>)) {
        if (val && typeof val === 'object' && 'roles' in (val as Record<string, unknown>)) {
          const cr = (val as Record<string, unknown>).roles
          if (Array.isArray(cr)) roles.push(...(cr as string[]).map(r => `${client}:${r}`))
        }
      }
    }
    if (Array.isArray(payload.roles)) roles.push(...(payload.roles as string[]))
    return roles
  }

  return (
    <div>
      <h2 style={S.pageTitle}>JWT Decoder</h2>
      <div style={S.card}>
        <label style={S.label}>JWT Token</label>
        <textarea value={token} onChange={e => setToken(e.target.value)} rows={4} style={S.mono} placeholder="eyJhbGciOiJSUzI1NiIsInR5..." />
        <div style={{ marginTop: 12 }}>
          <button style={S.btn} onClick={decode}>Decode</button>
        </div>
      </div>
      {result && (
        <div style={S.card}>
          {result.error
            ? <p style={S.errTxt}>{result.error}</p>
            : <>
                <h3 style={{ fontSize: 13, marginBottom: 8, fontWeight: 600, color: 'var(--tx-2)' }}>Header</h3>
                <div style={{ ...S.result, marginBottom: 16 }}>{JSON.stringify(result.header, null, 2)}</div>
                <h3 style={{ fontSize: 13, marginBottom: 8, fontWeight: 600, color: 'var(--tx-2)' }}>Payload</h3>
                <div style={{ ...S.result, marginBottom: 16 }}>{JSON.stringify(result.payload, null, 2)}</div>
                {result.payload && (
                  <>
                    {formatExpiry(result.payload).map((line, i) => (
                      <div key={i} style={{ fontSize: 12, color: line.includes('EXPIRED') ? 'var(--err)' : 'var(--ok)', marginBottom: 4 }}>{line}</div>
                    ))}
                    {extractRoles(result.payload).length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <label style={S.label}>Roles</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {extractRoles(result.payload).map((r, i) => <span key={i} style={S.badge}>{r}</span>)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
          }
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// JSON Tools
// ══════════════════════════════════════════════════════════════════════════════

function JToolBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s1)', flexShrink: 0 }}>
      {children}
    </div>
  )
}

function JActionBtn({ onClick, loading, children }: { onClick: () => void; loading: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, background: 'var(--ac)', color: '#fff', borderRadius: 6, opacity: loading ? 0.6 : 1, border: 'none', cursor: 'pointer' }}>
      {loading ? 'Processing...' : children}
    </button>
  )
}

function JCopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { if (!text) return; navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ padding: '6px 12px', fontSize: 11, color: copied ? 'var(--ok)' : 'var(--tx-2)', border: '1px solid var(--bd)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
      {copied ? 'Copied!' : 'Copy output'}
    </button>
  )
}

function JPasteBtn({ onPaste }: { onPaste: (t: string) => void }) {
  return (
    <button onClick={async () => onPaste(await navigator.clipboard.readText())}
      style={{ padding: '6px 12px', fontSize: 11, color: 'var(--tx-2)', border: '1px solid var(--bd)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>
      Paste
    </button>
  )
}

function JErrorBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 16px', fontSize: 12, background: 'rgba(248,113,113,0.08)', borderBottom: '1px solid rgba(248,113,113,0.2)', color: 'var(--err)', flexShrink: 0 }}>
      {children}
    </div>
  )
}

interface EditorPaneProps {
  value: string; onChange?: (v: string) => void; readOnly?: boolean
  placeholder: string; label: string
  onDrop?: (text: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void
}

function EditorPane({ value, onChange, readOnly, placeholder, label, onDrop, onKeyDown }: EditorPaneProps) {
  const [dragOver, setDragOver] = useState(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); if (!onDrop) return
    const file = e.dataTransfer.files[0]
    if (file) { const r = new FileReader(); r.onload = () => onDrop(r.result as string); r.readAsText(file) }
    else { const t = e.dataTransfer.getData('text'); if (t) onDrop(t) }
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: dragOver ? 'rgba(167,139,250,0.04)' : 'var(--bg)', transition: 'background 0.15s' }}
      onDragOver={e => { e.preventDefault(); if (onDrop) setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid var(--bd)' }}>
        {label}{dragOver && <span style={{ color: 'var(--ac)', marginLeft: 8 }}>Drop file here</span>}
      </div>
      <textarea value={value} onChange={onChange ? e => onChange(e.target.value) : undefined} readOnly={readOnly}
        placeholder={placeholder} onKeyDown={onKeyDown}
        style={{ flex: 1, border: 'none', borderRadius: 0, resize: 'none', background: 'transparent', fontFamily: 'var(--mono)', fontSize: 13 }}
        spellCheck={false} />
    </div>
  )
}

function FormatTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [indent, setIndent] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const format = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await jsonApi.format(input, indent)
      setOutput(res.result); if (!res.valid) setError(res.error)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }, [input, indent])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <JToolBar>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--tx-2)' }}>
          Indent:
          <select value={indent} onChange={e => setIndent(Number(e.target.value))} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--tx)', padding: '4px 8px', fontSize: 12 }}>
            {[2, 3, 4].map(n => <option key={n} value={n}>{n} spaces</option>)}
            <option value={1}>Tab</option>
          </select>
        </label>
        <JActionBtn onClick={format} loading={loading}>Format</JActionBtn>
        <JCopyBtn text={output} />
        <JPasteBtn onPaste={setInput} />
      </JToolBar>
      {error && <JErrorBar>{error}</JErrorBar>}
      <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--bd)', overflow: 'hidden' }}>
        <EditorPane value={input} onChange={setInput} placeholder="Paste or type JSON here..." label="Input" onDrop={setInput} />
        <EditorPane value={output} readOnly placeholder="Formatted output" label="Output" />
      </div>
    </div>
  )
}

function CompactTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const compact = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true); setError(null)
    try {
      const res = await jsonApi.compact(input)
      setOutput(res.result); if (!res.valid) setError(res.error)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }, [input])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <JToolBar>
        <JActionBtn onClick={compact} loading={loading}>Compact</JActionBtn>
        <JCopyBtn text={output} />
        <JPasteBtn onPaste={setInput} />
        {output && <span style={{ fontSize: 11, color: 'var(--tx-3)', marginLeft: 8 }}>{input.length} → {output.length} chars ({Math.round((1 - output.length / input.length) * 100)}% smaller)</span>}
      </JToolBar>
      {error && <JErrorBar>{error}</JErrorBar>}
      <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--bd)', overflow: 'hidden' }}>
        <EditorPane value={input} onChange={setInput} placeholder="Paste formatted JSON here..." label="Input" onDrop={setInput} />
        <EditorPane value={output} readOnly placeholder="Compacted output (single line)" label="Output" />
      </div>
    </div>
  )
}

// ── Diff types & helpers ──────────────────────────────────────────────────────

type LineDiffType = 'added' | 'removed' | 'changed' | null
interface LineDiff { leftLines: string[]; rightLines: string[]; leftHighlights: LineDiffType[]; rightHighlights: LineDiffType[] }

function computeLineDiff(lj: string, rj: string): LineDiff | null {
  try {
    const L = JSON.stringify(JSON.parse(lj), null, 2).split('\n')
    const R = JSON.stringify(JSON.parse(rj), null, 2).split('\n')
    const m = L.length, n = R.length
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = L[i-1] === R[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1])
    const stack: Array<[string, string, LineDiffType, LineDiffType]> = []
    let i = m, j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && L[i-1] === R[j-1]) { stack.push([L[i-1], R[j-1], null, null]); i--; j-- }
      else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { stack.push(['', R[j-1], null, 'added']); j-- }
      else { stack.push([L[i-1], '', 'removed', null]); i-- }
    }
    stack.reverse()
    const merged: typeof stack = []; let si = 0
    while (si < stack.length) {
      const [l, r, lh, rh] = stack[si]
      if (lh === 'removed' && si+1 < stack.length && stack[si+1][3] === 'added') {
        const [, r2] = stack[si+1]
        if (l.replace(/\s/g,'').split(':')[0] === r2.replace(/\s/g,'').split(':')[0]) {
          merged.push([l, r2, 'changed', 'changed']); si += 2; continue
        }
      }
      merged.push([l, r, lh, rh]); si++
    }
    const aL: string[] = [], aR: string[] = [], HL: LineDiffType[] = [], HR: LineDiffType[] = []
    for (const [l, r, lh, rh] of merged) { aL.push(l); aR.push(r); HL.push(lh); HR.push(rh) }
    return { leftLines: aL, rightLines: aR, leftHighlights: HL, rightHighlights: HR }
  } catch { return null }
}

function DiffPane({ lines, highlights, label, scrollRef, onScroll }: { lines: string[]; highlights: LineDiffType[]; label: string; scrollRef?: React.RefObject<HTMLDivElement | null>; onScroll?: () => void }) {
  const bgMap: Record<string, string> = { added: 'rgba(52,211,153,0.1)', removed: 'rgba(248,113,113,0.1)', changed: 'rgba(251,191,36,0.1)' }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
      <div style={{ padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid var(--bd)' }}>{label}</div>
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', fontFamily: 'monospace', fontSize: 13, lineHeight: '20px' }}>
        {lines.map((line, i) => (
          <div key={i} style={{ display: 'flex', minHeight: 20, background: highlights[i] ? bgMap[highlights[i]!] : 'transparent', whiteSpace: 'pre' }}>
            <span style={{ width: 44, flexShrink: 0, textAlign: 'right', paddingRight: 12, color: 'var(--tx-3)', fontSize: 11, userSelect: 'none', borderRight: '1px solid var(--bd)' }}>
              {line !== '' ? i+1 : ''}
            </span>
            <span style={{ paddingLeft: 8, color: 'var(--tx)' }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SyncedDiffPanes({ lineDiff }: { lineDiff: LineDiff }) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)
  const sync = (src: 'left' | 'right') => {
    if (syncing.current) return; syncing.current = true
    const s = src === 'left' ? leftRef.current : rightRef.current
    const t = src === 'left' ? rightRef.current : leftRef.current
    if (s && t) { t.scrollTop = s.scrollTop; t.scrollLeft = s.scrollLeft }
    requestAnimationFrame(() => { syncing.current = false })
  }
  return (
    <>
      <DiffPane lines={lineDiff.leftLines} highlights={lineDiff.leftHighlights} label="Left" scrollRef={leftRef} onScroll={() => sync('left')} />
      <DiffPane lines={lineDiff.rightLines} highlights={lineDiff.rightHighlights} label="Right" scrollRef={rightRef} onScroll={() => sync('right')} />
    </>
  )
}

function DiffTool() {
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
      setResult(res); const ld = computeLineDiff(left, right); setLineDiff(ld); if (ld) setViewMode('diff')
    } catch { /* ignore */ }
    setLoading(false)
  }, [left, right])

  const handleKD = useCallback((e: React.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); compare() } }, [compare])
  const backToEdit = () => { setViewMode('edit'); setLineDiff(null) }
  const setL = (v: string) => { setLeft(v); setResult(null); setViewMode('edit'); setLineDiff(null) }
  const setR = (v: string) => { setRight(v); setResult(null); setViewMode('edit'); setLineDiff(null) }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <JToolBar>
        <JActionBtn onClick={compare} loading={loading}>Compare</JActionBtn>
        {viewMode === 'diff' && <button onClick={backToEdit} style={{ padding: '6px 12px', fontSize: 11, color: 'var(--tx-2)', border: '1px solid var(--bd)', borderRadius: 6, background: 'transparent', cursor: 'pointer' }}>Edit</button>}
        {result && <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 8, color: result.equal ? 'var(--ok)' : 'var(--err)' }}>{result.equal ? 'Identical' : `${result.differences.length} difference${result.differences.length !== 1 ? 's' : ''}`}</span>}
        <span style={{ fontSize: 11, color: 'var(--tx-3)', marginLeft: 4 }}>Ctrl+Enter to compare</span>
        <button onClick={() => { const t = left; setLeft(right); setRight(t); setResult(null); setViewMode('edit'); setLineDiff(null) }}
          style={{ padding: '6px 10px', fontSize: 12, color: 'var(--tx-2)', border: '1px solid var(--bd)', borderRadius: 6, marginLeft: 'auto', background: 'transparent', cursor: 'pointer' }}>⇄ Swap</button>
      </JToolBar>
      {result?.error && <JErrorBar>{result.error}</JErrorBar>}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', gap: 1, background: 'var(--bd)', overflow: 'hidden', minHeight: 0 }}>
          {viewMode === 'edit' || !lineDiff ? (
            <>
              <EditorPane value={left} onChange={setL} placeholder="Left JSON..." label="Left" onDrop={setL} onKeyDown={handleKD} />
              <EditorPane value={right} onChange={setR} placeholder="Right JSON..." label="Right" onDrop={setR} onKeyDown={handleKD} />
            </>
          ) : <SyncedDiffPanes lineDiff={lineDiff} />}
        </div>
        {result && !result.equal && result.differences.length > 0 && (
          <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid var(--bd)', background: 'var(--s1)', flexShrink: 0 }}>
            <div style={{ padding: '8px 16px 4px' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Differences</span>
            </div>
            {result.differences.map((d, i) => {
              const bgM = { added: 'rgba(52,211,153,0.06)', removed: 'rgba(248,113,113,0.06)', changed: 'rgba(251,191,36,0.06)' }
              const bdM = { added: 'rgba(52,211,153,0.2)', removed: 'rgba(248,113,113,0.2)', changed: 'rgba(251,191,36,0.2)' }
              const cM = { added: 'var(--ok)', removed: 'var(--err)', changed: 'var(--warn)' }
              return (
                <div key={i} style={{ margin: '0 12px 4px', padding: '8px 12px', background: bgM[d.type], border: `1px solid ${bdM[d.type]}`, borderRadius: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '1px 5px', borderRadius: 3, background: bdM[d.type], color: cM[d.type] }}>{d.type.toUpperCase()}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 11.5, color: 'var(--tx)' }}>{d.path}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 11 }}>
                    {d.leftValue !== null && <div style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--tx-3)', fontSize: 9, textTransform: 'uppercase' }}>left: </span><span style={{ color: 'var(--err)', wordBreak: 'break-all' }}>{d.leftValue}</span></div>}
                    {d.rightValue !== null && <div style={{ flex: 1, minWidth: 0 }}><span style={{ color: 'var(--tx-3)', fontSize: 9, textTransform: 'uppercase' }}>right: </span><span style={{ color: 'var(--ok)', wordBreak: 'break-all' }}>{d.rightValue}</span></div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Infra Monitor
// ══════════════════════════════════════════════════════════════════════════════

const stateBg = (s: string) => {
  if (s === 'LISTEN') return { background: 'rgba(52,211,153,0.1)', color: 'var(--ok)' }
  if (s === 'ESTABLISHED') return { background: 'rgba(96,165,250,0.1)', color: 'var(--info)' }
  if (s === 'TIME_WAIT' || s === 'CLOSE_WAIT') return { background: 'rgba(251,191,36,0.1)', color: 'var(--warn)' }
  return { background: 'rgba(156,163,175,0.1)', color: 'var(--tx-2)' }
}

function PortsTool() {
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [scannedAt, setScannedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [portalExpanded, setPortalExpanded] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPorts = useCallback(async () => {
    setLoading(true); setError(null)
    try { const res = await infraApi.ports(); setPorts(res.ports); setScannedAt(res.scannedAt) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void fetchPorts() }, [fetchPorts])

  useEffect(() => {
    if (autoRefresh) { intervalRef.current = setInterval(() => void fetchPorts(), 5000) }
    else if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, fetchPorts])

  const nonPortal = ports.filter(p => !p.isPortal)
  const portal = ports.filter(p => p.isPortal)

  const isConflict = (p: PortInfo) =>
    p.isPortal && !!p.portalModule && p.state === 'LISTEN' && p.process != null && p.process !== '' &&
    !['java', 'docker-proxy', 'nginx', 'postgres', 'ttyd'].some(e => p.process!.toLowerCase().includes(e))

  const tblStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 }
  const thS: CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--bd)', color: 'var(--tx-3)', fontSize: 11, fontWeight: 600 }
  const tdS: CSSProperties = { padding: '8px 12px', borderBottom: '1px solid var(--bd)', fontFamily: 'var(--mono)', fontSize: 12 }

  const PortRow = ({ p, i }: { p: PortInfo; i: number }) => (
    <tr key={`${p.port}-${p.protocol}-${i}`} style={{ cursor: p.state === 'LISTEN' ? 'pointer' : 'default' }}
      onClick={() => p.state === 'LISTEN' && window.open(`http://localhost:${p.port}`, '_blank')}>
      <td style={{ ...tdS, fontWeight: 600 }}>{p.port}</td>
      <td style={tdS}>{p.protocol}</td>
      <td style={tdS}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, ...stateBg(p.state) }}>{p.state}</span></td>
      <td style={{ ...tdS, opacity: 0.6 }}>{p.pid ?? '–'}</td>
      <td style={tdS}>{p.process ?? '–'}</td>
      <td style={tdS}>{p.portalModule && <span style={{ background: 'var(--ac-dim)', color: 'var(--ac)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{p.portalModule}</span>}</td>
      <td style={tdS}>{isConflict(p) && <span style={{ background: 'rgba(251,191,36,0.12)', color: 'var(--warn)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>CONFLICT</span>}</td>
    </tr>
  )

  return (
    <div>
      <h2 style={S.pageTitle}>Port Radar</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        {scannedAt && <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>Last scan: {new Date(scannedAt).toLocaleTimeString()}</span>}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => setAutoRefresh(p => !p)}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--bd)', background: autoRefresh ? 'var(--ac-dim)' : 'transparent', color: autoRefresh ? 'var(--ac)' : 'var(--tx-2)', cursor: 'pointer' }}>
            {autoRefresh ? 'Auto ON (5s)' : 'Auto OFF'}
          </button>
          <button onClick={() => void fetchPorts()} disabled={loading}
            style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--tx-2)', cursor: 'pointer' }}>
            {loading ? 'Scanning…' : 'Refresh'} <kbd style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 4px' }}>r</kbd>
          </button>
        </div>
      </div>
      {error && <div style={{ padding: '12px 16px', background: 'var(--err-dim)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 6, color: 'var(--err)', marginBottom: 14, fontSize: 13 }}>{error}</div>}
      <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={tblStyle}>
          <thead><tr><th style={thS}>Port</th><th style={thS}>Protocol</th><th style={thS}>State</th><th style={thS}>PID</th><th style={thS}>Process</th><th style={thS}>Module</th><th style={thS}></th></tr></thead>
          <tbody>
            {ports.length === 0 && !loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--tx-2)' }}>No ports found</td></tr>}
            {nonPortal.map((p, i) => <PortRow key={i} p={p} i={i} />)}
            {portal.length > 0 && (
              <tr onClick={() => setPortalExpanded(p => !p)} style={{ cursor: 'pointer', background: 'var(--s3)', userSelect: 'none' }}>
                <td colSpan={7} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--tx-3)' }}>
                  {portalExpanded ? '▾' : '▸'} Dev Hub ports ({portal.length})
                </td>
              </tr>
            )}
            {portalExpanded && portal.map((p, i) => <PortRow key={`portal-${i}`} p={p} i={i} />)}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Infra shared (used by both PortsTool + ServicesTool defined after GitHistory) ──

function ServicesTool() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [interval_, setInterval_] = useState(10000)
  const [editMode, setEditMode] = useState(false)
  const [editedServices, setEditedServices] = useState<ServiceConfig[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try { setData(await infraApi.getStatus()) } catch { /* keep last */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (interval_ > 0) timerRef.current = setInterval(fetchStatus, interval_)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [interval_, fetchStatus])

  const startEdit = async () => { setEditedServices(await infraApi.getConfig()); setEditMode(true) }
  const saveEdit = async () => { await infraApi.updateConfig(editedServices); setEditMode(false); fetchStatus() }

  if (loading && !data) return <div style={{ padding: 32, color: 'var(--tx-2)' }}>Checking services…</div>

  const services = data?.services ?? []
  const up = services.filter(s => s.status === 'up').length
  const down = services.filter(s => s.status === 'down').length
  const degraded = services.filter(s => s.status === 'degraded').length
  const summaryColor = down > 0 ? 'var(--err)' : degraded > 0 ? 'var(--warn)' : 'var(--ok)'

  if (editMode) return (
    <div>
      <h2 style={S.pageTitle}>Health Dashboard — Edit Services</h2>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setEditMode(false)} style={{ ...S.btnOutline }}>Cancel</button>
        <button onClick={saveEdit} style={{ ...S.btn }}>Save</button>
      </div>
      {editedServices.map((svc, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={svc.name} onChange={e => setEditedServices(p => p.map((s, j) => j === i ? { ...s, name: e.target.value } : s))} placeholder="Name" style={{ width: 180 }} />
          <input value={svc.url} onChange={e => setEditedServices(p => p.map((s, j) => j === i ? { ...s, url: e.target.value } : s))} placeholder="URL" style={{ flex: 1 }} />
          <button onClick={() => setEditedServices(p => p.filter((_, j) => j !== i))} style={{ color: 'var(--err)', padding: '4px 10px', background: 'transparent', border: '1px solid var(--bd)', borderRadius: 6, cursor: 'pointer' }}>✕</button>
        </div>
      ))}
      <button onClick={() => setEditedServices(p => [...p, { name: '', url: '' }])} style={{ ...S.btnOutline, marginTop: 8 }}>+ Add</button>
    </div>
  )

  return (
    <div>
      <h2 style={S.pageTitle}>Health Dashboard</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: summaryColor }} />
          <span style={{ fontSize: 13, color: 'var(--tx)' }}>{up}/{services.length} up{degraded > 0 ? ` · ${degraded} degraded` : ''}{down > 0 ? ` · ${down} down` : ''}</span>
          {data && <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>· {new Date(data.checkedAt).toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={startEdit} style={S.btnOutline}>Edit</button>
          <select value={interval_} onChange={e => setInterval_(Number(e.target.value))}
            style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, color: 'var(--tx)', padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
            <option value={0}>Off</option>
          </select>
          <button onClick={() => { setLoading(true); fetchStatus() }} style={S.btnOutline}>Refresh</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {services.map(svc => {
          const c = svc.status === 'up' ? 'var(--ok)' : svc.status === 'degraded' ? 'var(--warn)' : 'var(--err)'
          const bg = svc.status === 'up' ? 'rgba(52,211,153,0.06)' : svc.status === 'degraded' ? 'rgba(251,191,36,0.06)' : 'rgba(248,113,113,0.06)'
          return (
            <div key={svc.name} style={{ background: 'var(--s2)', border: `1px solid var(--bd)`, borderRadius: 8, padding: '14px 16px', borderLeft: `3px solid ${c}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: bg, color: c }}>{svc.status.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{svc.responseTimeMs}ms</span>
              </div>
              {svc.error && <div style={{ fontSize: 11, color: 'var(--err)', marginTop: 8, opacity: 0.8 }}>{svc.error}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Git History
// ══════════════════════════════════════════════════════════════════════════════

const GIT_BASE = 'http://localhost:10415'
async function gitReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${GIT_BASE}${path}`, opts)
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}
function gitPost<T>(path: string, body: unknown): Promise<T> {
  return gitReq(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
function enc(s: string) { return encodeURIComponent(s) }

interface GRepoInfo { name: string; path: string }
interface GBranchInfo { name: string; current: boolean }
interface GCommitInfo { hash: string; shortHash: string; message: string; author: string; authorEmail: string; date: string; relativeDate: string }
interface GDiffLine { type: 'add' | 'remove' | 'context'; content: string; oldLineNum?: number; newLineNum?: number }
interface GDiffHunk { header: string; lines: GDiffLine[] }
interface GDiffFile { path: string; status: string; hunks: GDiffHunk[] }
interface GCommitDetail { hash: string; shortHash: string; message: string; author: string; authorEmail: string; date: string; files: GDiffFile[] }
interface GTreeEntry { name: string; path: string; type: 'blob' | 'tree'; size?: number }
interface GFileContent { path: string; content: string; lines: number }
interface GBlameEntry { lineStart: number; lineEnd: number; hash: string; shortHash: string; author: string; authorEmail: string; date: string; relativeDate: string; line: string }
interface GLineHistoryEntry { hash: string; shortHash: string; author: string; date: string; relativeDate: string; message: string; diff: string }

const gitApi = {
  getRepos: () => gitReq<GRepoInfo[]>('/repos'),
  getBranches: (repo: string) => gitReq<GBranchInfo[]>(`/repos/${enc(repo)}/branches`),
  getCommits: (repo: string, branch: string, limit = 50, offset = 0) =>
    gitReq<GCommitInfo[]>(`/repos/${enc(repo)}/commits?branch=${enc(branch)}&limit=${limit}&offset=${offset}`),
  getCommitDetail: (repo: string, hash: string) => gitReq<GCommitDetail>(`/repos/${enc(repo)}/commits/${hash}`),
  getTree: (repo: string, ref: string, path = '') =>
    gitReq<GTreeEntry[]>(`/repos/${enc(repo)}/tree?ref=${enc(ref)}&path=${enc(path)}`),
  getFile: (repo: string, path: string, ref: string) =>
    gitReq<GFileContent>(`/repos/${enc(repo)}/file?path=${enc(path)}&ref=${enc(ref)}`),
  getFileHistory: (repo: string, path: string, branch = 'HEAD', limit = 50) =>
    gitReq<GCommitInfo[]>(`/repos/${enc(repo)}/file/history?path=${enc(path)}&branch=${enc(branch)}&limit=${limit}`),
  getBlame: (repo: string, path: string, start: number, end: number, ref = 'HEAD') =>
    gitReq<GBlameEntry[]>(`/repos/${enc(repo)}/blame?path=${enc(path)}&start=${start}&end=${end}&ref=${enc(ref)}`),
  getLineHistory: (repo: string, path: string, start: number, end: number, limit?: number) =>
    gitReq<GLineHistoryEntry[]>(`/repos/${enc(repo)}/line-history?path=${enc(path)}&start=${start}&end=${end}${limit ? `&limit=${limit}` : ''}`),
  getConfig: () => gitReq<Record<string, string>>('/config'),
  setConfig: (cfg: { directories?: string[] }) =>
    gitPost<Record<string, string>>('/config', cfg),
}

type GMode = 'commits' | 'files' | 'trace'

function GitHistoryTool() {
  const [repos, setRepos] = useState<GRepoInfo[]>([])
  const [repo, setRepo] = useState('')
  const [branches, setBranches] = useState<GBranchInfo[]>([])
  const [branch, setBranch] = useState('HEAD')
  const [mode, setMode] = useState<GMode>('commits')
  const [showConfig, setShowConfig] = useState(false)
  const [configDirs, setConfigDirs] = useState<string[]>([])
  const [error, setError] = useState('')

  const [commits, setCommits] = useState<GCommitInfo[]>([])
  const [selectedCommit, setSelectedCommit] = useState('')
  const [commitDetail, setCommitDetail] = useState<GCommitDetail | null>(null)
  const [commitOffset, setCommitOffset] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [tree, setTree] = useState<GTreeEntry[]>([])
  const [treePath, setTreePath] = useState('')
  const [fileContent, setFileContent] = useState<GFileContent | null>(null)
  const [fileHistory, setFileHistory] = useState<GCommitInfo[]>([])
  const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [showFileHistory, setShowFileHistory] = useState(false)
  const [fileHistoryCommit, setFileHistoryCommit] = useState<GCommitDetail | null>(null)

  const [blameData, setBlameData] = useState<GBlameEntry[]>([])
  const [lineHistory, setLineHistory] = useState<GLineHistoryEntry[]>([])
  const [showLineHistory, setShowLineHistory] = useState(false)
  const [lineHistoryLoading, setLineHistoryLoading] = useState(false)
  const [traceLimit, setTraceLimit] = useState(20)

  useEffect(() => {
    gitApi.getConfig().then(cfg => {
      const dirs = (cfg.directories || '').split(',').filter(Boolean)
      setConfigDirs(dirs)
    }).catch(() => {})
    gitApi.getRepos().then(r => {
      setRepos(r)
      if (r.length > 0) setRepo(r[0].path)
    }).catch(e => setError(e.message))
  }, [])

  useEffect(() => {
    if (!repo) return
    setBranches([]); setBranch('HEAD')
    gitApi.getBranches(repo).then(b => {
      setBranches(b)
      const cur = b.find(br => br.current)
      if (cur) setBranch(cur.name)
    }).catch(() => {})
  }, [repo])

  useEffect(() => {
    if (!repo || !branch) return
    if (mode === 'commits') {
      setCommitOffset(0); setSelectedCommit(''); setCommitDetail(null)
      gitApi.getCommits(repo, branch, 50, 0).then(setCommits).catch(() => {})
    } else if (mode === 'files') {
      setTreePath(''); setFileContent(null); setSelectedLines(new Set())
      setBlameData([]); setLineHistory([]); setShowLineHistory(false)
      gitApi.getTree(repo, branch).then(setTree).catch(() => {})
    }
  }, [repo, branch, mode])

  const loadMoreCommits = useCallback(() => {
    if (loadingMore) return; setLoadingMore(true)
    const newOffset = commitOffset + 50
    gitApi.getCommits(repo, branch, 50, newOffset)
      .then(more => { setCommits(prev => [...prev, ...more]); setCommitOffset(newOffset) })
      .finally(() => setLoadingMore(false))
  }, [repo, branch, commitOffset, loadingMore])

  const selectCommit = useCallback((hash: string) => {
    setSelectedCommit(hash)
    gitApi.getCommitDetail(repo, hash).then(setCommitDetail).catch(() => {})
  }, [repo])

  const navigateTree = useCallback((entry: GTreeEntry) => {
    const fullPath = treePath ? `${treePath}/${entry.path}` : entry.path
    if (entry.type === 'tree') {
      setTreePath(fullPath); setFileContent(null); setSelectedLines(new Set())
      setBlameData([]); setLineHistory([]); setShowLineHistory(false); setShowFileHistory(false)
      gitApi.getTree(repo, branch, fullPath).then(setTree).catch(() => {})
    } else {
      gitApi.getFile(repo, fullPath, branch).then(fc => {
        setFileContent(fc); setSelectedLines(new Set()); setBlameData([])
        setLineHistory([]); setShowLineHistory(false)
      }).catch(() => {})
    }
  }, [repo, branch, treePath])

  const navigateBreadcrumb = useCallback((idx: number) => {
    const newPath = treePath.split('/').slice(0, idx).join('/')
    setTreePath(newPath); setFileContent(null); setSelectedLines(new Set()); setBlameData([])
    gitApi.getTree(repo, branch, newPath).then(setTree).catch(() => {})
  }, [repo, branch, treePath])

  const handleLineClick = useCallback((lineNum: number, e: React.MouseEvent) => {
    if (e.shiftKey && selectionStart !== null) {
      const start = Math.min(selectionStart, lineNum); const end = Math.max(selectionStart, lineNum)
      const s = new Set<number>(); for (let i = start; i <= end; i++) s.add(i); setSelectedLines(s)
    } else { setSelectedLines(new Set([lineNum])); setSelectionStart(lineNum) }
  }, [selectionStart])

  const loadBlame = useCallback(() => {
    if (selectedLines.size === 0 || !fileContent) return
    const sorted = Array.from(selectedLines).sort((a, b) => a - b)
    gitApi.getBlame(repo, fileContent.path, sorted[0], sorted[sorted.length - 1], branch)
      .then(setBlameData).catch(() => {})
    setShowLineHistory(false); setLineHistory([]); setMode('trace')
  }, [repo, branch, fileContent, selectedLines])

  const loadLineHistory = useCallback(() => {
    if (selectedLines.size === 0 || !fileContent) return
    const sorted = Array.from(selectedLines).sort((a, b) => a - b)
    setLineHistoryLoading(true)
    gitApi.getLineHistory(repo, fileContent.path, sorted[0], sorted[sorted.length - 1], traceLimit)
      .then(lh => { setLineHistory(lh); setShowLineHistory(true) })
      .catch(() => {}).finally(() => setLineHistoryLoading(false))
  }, [repo, fileContent, selectedLines, traceLimit])

  const loadFileHistory = useCallback(() => {
    if (!fileContent) return
    gitApi.getFileHistory(repo, fileContent.path, branch)
      .then(h => { setFileHistory(h); setShowFileHistory(true) })
      .catch(() => {})
  }, [repo, branch, fileContent])

  const saveConfig = useCallback(() => {
    gitApi.setConfig({ directories: configDirs.filter(Boolean) }).then(() => {
      gitApi.getRepos().then(r => { setRepos(r); if (r.length > 0 && !repo) setRepo(r[0].path) })
      setShowConfig(false)
    }).catch(e => setError(e.message))
  }, [configDirs, repo])

  if (showConfig) return (
    <div className="gh-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 20, margin: 16, width: 500, maxWidth: '90%' }}>
        <h2 style={{ marginBottom: 14, fontSize: 16, fontWeight: 700 }}>Git History Config</h2>
        <label style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 6, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Repository directories (one per line)</label>
        <textarea value={configDirs.join('\n')} onChange={e => setConfigDirs(e.target.value.split('\n'))} rows={6}
          style={{ fontFamily: 'var(--mono)', fontSize: 13, marginBottom: 14 }}
          placeholder="/home/user/projects/repo1&#10;/home/user/projects/repo2" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={S.btnOutline} onClick={() => setShowConfig(false)}>Cancel</button>
          <button style={S.btn} onClick={saveConfig}>Save</button>
        </div>
      </div>
    </div>
  )

  if (repos.length === 0) return (
    <div className="gh-root" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 10, padding: 20, margin: 16, width: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📜</div>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>No repositories configured</h2>
        <p style={{ color: 'var(--tx-2)', marginBottom: 16, fontSize: 13 }}>Add repository directories to get started.</p>
        <button style={S.btn} onClick={() => setShowConfig(true)}>Configure Repos</button>
        {error && <p style={{ color: 'var(--err)', marginTop: 12, fontSize: 12 }}>{error}</p>}
      </div>
    </div>
  )

  return (
    <div className="gh-root">
      {/* Sidebar */}
      <div className="gh-sidebar">
        <div className="gh-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Git History</span>
            <button style={{ padding: '4px 10px', fontSize: 11, background: 'transparent', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--tx-2)', cursor: 'pointer' }} onClick={() => setShowConfig(true)}>Config</button>
          </div>
          <select value={repo} onChange={e => setRepo(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
            {repos.map(r => <option key={r.path} value={r.path}>{r.name}</option>)}
          </select>
          <select value={branch} onChange={e => setBranch(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}{b.current ? ' *' : ''}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 0, background: 'var(--s3)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bd)' }}>
            {(['commits', 'files', 'trace'] as GMode[]).map(m => (
              <button key={m} className={`gh-tab ${mode === m ? 'active' : ''}`} onClick={() => setMode(m)}>
                {m === 'commits' ? 'Commits' : m === 'files' ? 'Files' : 'Trace'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {mode === 'commits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: 4 }}>
              {commits.map(c => (
                <div key={c.hash} className={`gh-commit-item ${selectedCommit === c.hash ? 'active' : ''}`} onClick={() => selectCommit(c.hash)}>
                  <div className="gh-commit-msg"><span className="gh-commit-hash">{c.shortHash}</span>{c.message}</div>
                  <div className="gh-commit-meta">{c.author} · {c.relativeDate}</div>
                </div>
              ))}
              {commits.length >= 50 && (
                <button style={{ margin: '8px 14px', ...S.btnOutline }} onClick={loadMoreCommits} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
          {mode === 'files' && !fileContent && (
            <div>
              {treePath && (
                <div className="gh-breadcrumb" style={{ borderBottom: '1px solid var(--bd)' }}>
                  <span className="gh-breadcrumb-part" onClick={() => navigateBreadcrumb(0)}>/</span>
                  {treePath.split('/').map((part, i) => (
                    <span key={i}><span className="gh-breadcrumb-sep">/</span><span className="gh-breadcrumb-part" onClick={() => navigateBreadcrumb(i + 1)}>{part}</span></span>
                  ))}
                </div>
              )}
              {tree.map(entry => (
                <div key={entry.path} className={`gh-tree-item ${entry.type === 'tree' ? 'dir' : 'file'}`} onClick={() => navigateTree(entry)}>
                  <span>{entry.type === 'tree' ? '📁' : '📄'}</span>
                  <span style={{ flex: 1 }}>{entry.name}</span>
                  {entry.size != null && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{gFmtSize(entry.size)}</span>}
                </div>
              ))}
            </div>
          )}
          {mode === 'files' && fileContent && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', fontSize: 12 }}>
              <button style={{ padding: '3px 8px', fontSize: 11, ...S.btnOutline, marginRight: 8 }} onClick={() => { setFileContent(null); setSelectedLines(new Set()); setBlameData([]) }}>Back</button>
              <button style={{ padding: '3px 8px', fontSize: 11, ...S.btnOutline, marginRight: 8 }} onClick={loadFileHistory}>History</button>
              {selectedLines.size > 0 && (
                <button style={{ padding: '3px 8px', fontSize: 11, ...S.btn }} onClick={loadBlame}>
                  Blame L{Math.min(...selectedLines)}{selectedLines.size > 1 ? `-L${Math.max(...selectedLines)}` : ''}
                </button>
              )}
            </div>
          )}
          {mode === 'trace' && (
            <div style={{ padding: '8px 12px' }}>
              {selectedLines.size > 0 && (
                <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 8 }}>
                  Lines {Math.min(...selectedLines)}-{Math.max(...selectedLines)} of {fileContent?.path}
                </div>
              )}
              {blameData.length > 0 && !showLineHistory && (
                <button style={{ width: '100%', marginBottom: 8, fontSize: 12, ...S.btn }} onClick={loadLineHistory} disabled={lineHistoryLoading}>
                  {lineHistoryLoading ? 'Loading…' : 'Full line history'}
                </button>
              )}
              {selectedLines.size === 0 && <p className="gh-empty" style={{ padding: 20 }}>Select lines in a file to trace their history</p>}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="gh-main">
        {error && (
          <div style={{ padding: '8px 16px', background: 'rgba(248,113,113,0.08)', color: 'var(--err)', fontSize: 12, borderBottom: '1px solid var(--bd)' }}>
            {error}
            <button style={{ marginLeft: 12, color: 'var(--err)', textDecoration: 'underline', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setError('')}>dismiss</button>
          </div>
        )}

        {mode === 'commits' && !commitDetail && <div className="gh-empty">Select a commit from the sidebar</div>}
        {mode === 'commits' && commitDetail && (
          <div className="gh-content"><GCommitDetailView detail={commitDetail} /></div>
        )}

        {(mode === 'files' || mode === 'trace') && fileContent && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {showFileHistory ? (
                <GFileHistoryView
                  history={fileHistory}
                  onSelect={hash => gitApi.getCommitDetail(repo, hash).then(d => setFileHistoryCommit(d)).catch(() => {})}
                  selectedCommit={fileHistoryCommit}
                  onClose={() => { setShowFileHistory(false); setFileHistoryCommit(null) }}
                />
              ) : (
                <GFileViewer file={fileContent} selectedLines={selectedLines} blameData={blameData} onLineClick={handleLineClick} />
              )}
            </div>
            {mode === 'trace' && (blameData.length > 0 || showLineHistory) && (
              <div className={`gh-blame-panel ${showLineHistory ? 'wide' : 'narrow'}`}>
                <div className="gh-blame-header">{showLineHistory ? 'Line History' : 'Blame'}</div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {!showLineHistory && blameData.map((b, i) => (
                    <div key={i} className="gh-blame-entry">
                      <div><span className="gh-commit-hash">{b.shortHash}</span><span style={{ fontWeight: 600 }}>{b.author}</span></div>
                      <div style={{ color: 'var(--tx-2)', fontSize: 11 }}>{b.relativeDate}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, marginTop: 4, color: 'var(--tx)', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.line}</div>
                    </div>
                  ))}
                  {showLineHistory && lineHistory.map((lh, i) => <GLineHistoryCard key={i} entry={lh} />)}
                  {showLineHistory && lineHistory.length >= traceLimit && (
                    <div style={{ padding: 12, textAlign: 'center' }}>
                      <button style={S.btn} onClick={() => { setTraceLimit(p => p + 20); loadLineHistory() }}>Go deeper</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'files' && !fileContent && <div className="gh-empty">Browse the file tree and select a file</div>}
      </div>
    </div>
  )
}

function GCommitDetailView({ detail }: { detail: GCommitDetail }) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ac)', background: 'var(--ac-dim)', padding: '2px 8px', borderRadius: 4 }}>{detail.shortHash}</span>
          <span style={{ fontSize: 11, color: 'var(--tx-2)' }}>{new Date(detail.date).toLocaleString()}</span>
        </div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--tx)' }}>{detail.message}</h2>
        <div style={{ fontSize: 12, color: 'var(--tx-2)' }}>{detail.author} &lt;{detail.authorEmail}&gt;</div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tx-2)', marginBottom: 12 }}>{detail.files.length} file{detail.files.length !== 1 ? 's' : ''} changed</div>
      {detail.files.map((file, i) => <GDiffFileView key={i} file={file} />)}
    </div>
  )
}

function GDiffFileView({ file }: { file: GDiffFile }) {
  const [collapsed, setCollapsed] = useState(false)
  const statusBg = { added: 'var(--add-bg)', deleted: 'var(--remove-bg)', modified: 'var(--ac-dim)' }
  const statusColor = { added: 'var(--add-text)', deleted: 'var(--remove-text)', modified: 'var(--ac)' }
  const bg = statusBg[file.status as keyof typeof statusBg] ?? 'var(--ac-dim)'
  const color = statusColor[file.status as keyof typeof statusColor] ?? 'var(--ac)'
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 10 }}>
      <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: bg, color }}>{file.status}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{file.path}</span>
        </div>
        <button style={{ padding: '2px 8px', fontSize: 11, ...S.btnOutline }} onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && file.hunks.map((hunk, j) => (
        <div key={j}>
          <div style={{ padding: '4px 14px', background: 'rgba(249,115,22,0.06)', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--tx-3)' }}>{hunk.header}</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6 }}>
            <tbody>
              {hunk.lines.map((line, k) => (
                <tr key={k}>
                  <td style={{ width: 50, textAlign: 'right', padding: '0 8px', color: 'var(--tx-3)', userSelect: 'none', verticalAlign: 'top' }}>{line.oldLineNum ?? ''}</td>
                  <td style={{ width: 50, textAlign: 'right', padding: '0 8px', color: 'var(--tx-3)', userSelect: 'none', verticalAlign: 'top' }}>{line.newLineNum ?? ''}</td>
                  <td className={`gh-diff-${line.type}`} style={{ padding: '0 12px', whiteSpace: 'pre' }}>
                    <span style={{ userSelect: 'none', color: 'var(--tx-3)', marginRight: 4 }}>{line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}</span>
                    {line.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function GFileViewer({ file, selectedLines, blameData, onLineClick }: { file: GFileContent; selectedLines: Set<number>; blameData: GBlameEntry[]; onLineClick: (line: number, e: React.MouseEvent) => void }) {
  const lines = file.content.split('\n')
  const blameMap = new Map<number, GBlameEntry>()
  blameData.forEach(b => { for (let i = b.lineStart; i <= b.lineEnd; i++) blameMap.set(i, b) })
  const hashColors = new Map<string, string>()
  const colors = ['rgba(249,115,22,0.08)', 'rgba(139,92,246,0.08)', 'rgba(59,130,246,0.08)', 'rgba(16,185,129,0.08)', 'rgba(236,72,153,0.08)']
  let ci = 0; blameData.forEach(b => { if (!hashColors.has(b.hash)) { hashColors.set(b.hash, colors[ci % colors.length]); ci++ } })

  return (
    <div>
      <div className="gh-file-header">
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{file.path}</span>
        <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{file.lines} lines</span>
      </div>
      {lines.map((line, i) => {
        const lineNum = i + 1
        const blame = blameMap.get(lineNum)
        const blameColor = blame ? hashColors.get(blame.hash) : undefined
        const isSelected = selectedLines.has(lineNum)
        return (
          <div key={i} className={`gh-code-line${isSelected ? ' selected' : ''}`}
            style={!isSelected && blameColor ? { background: blameColor } : undefined}
            onClick={e => onLineClick(lineNum, e)}>
            <div className="gh-line-num">{lineNum}</div>
            <div className="gh-line-content">{line}</div>
          </div>
        )
      })}
    </div>
  )
}

function GFileHistoryView({ history, onSelect, selectedCommit, onClose }: { history: GCommitInfo[]; onSelect: (hash: string) => void; selectedCommit: GCommitDetail | null; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>File History ({history.length} commits)</span>
        <button style={{ padding: '3px 8px', fontSize: 11, ...S.btnOutline }} onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 300, overflow: 'auto', borderRight: '1px solid var(--bd)' }}>
          {history.map(c => (
            <div key={c.hash} className={`gh-commit-item ${selectedCommit?.hash === c.hash ? 'active' : ''}`}
              style={{ padding: '8px 12px' }} onClick={() => onSelect(c.hash)}>
              <div style={{ fontSize: 12 }}><span className="gh-commit-hash">{c.shortHash}</span><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.message}</span></div>
              <div className="gh-commit-meta">{c.author} · {c.relativeDate}</div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {selectedCommit ? <GCommitDetailView detail={selectedCommit} /> : <div className="gh-empty">Select a commit to see the diff</div>}
        </div>
      </div>
    </div>
  )
}

function GLineHistoryCard({ entry }: { entry: GLineHistoryEntry }) {
  const [expanded, setExpanded] = useState(false)
  const initials = entry.author.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  const hue = entry.author.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  const diffLines = entry.diff ? entry.diff.split('\n') : []
  const hasDiff = diffLines.some(l => l.startsWith('+') || l.startsWith('-'))
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${hue},45%,38%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{entry.author}</span>
            <span style={{ fontSize: 11, color: 'var(--tx-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{entry.relativeDate}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--tx)', marginBottom: 6, lineHeight: 1.4 }}>{entry.message}</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ac)', marginBottom: hasDiff ? 8 : 0 }}>{entry.shortHash}</div>
          {hasDiff && (
            <>
              <button onClick={() => setExpanded(e => !e)}
                style={{ fontSize: 11, color: 'var(--tx-2)', background: 'var(--s3)', border: '1px solid var(--bd)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', marginBottom: expanded ? 8 : 0 }}>
                {expanded ? '▲ hide changes' : '▼ show changes'}
              </button>
              {expanded && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.5, borderRadius: 4, border: '1px solid var(--bd)', background: 'var(--bg)', overflow: 'auto' }}>
                  {diffLines.map((line, j) => (
                    <div key={j} style={{ padding: '0 8px', color: line.startsWith('+') ? 'var(--add-text)' : line.startsWith('-') ? 'var(--remove-text)' : 'var(--tx-3)', background: line.startsWith('+') ? 'var(--add-bg)' : line.startsWith('-') ? 'var(--remove-bg)' : 'transparent', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line || ' '}</div>
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

function gFmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
