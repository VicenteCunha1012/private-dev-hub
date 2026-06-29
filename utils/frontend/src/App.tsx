import { useState, useCallback, type CSSProperties } from 'react'
import { api, type RegexResponse, type CronResponse, type UrlParseResponse, type JwtDecodeResponse } from './api/utilsApi'

type Tab = 'regex' | 'cron' | 'uuid' | 'hash' | 'url' | 'jwt'

const TABS: { key: Tab; label: string }[] = [
  { key: 'regex', label: 'Regex' },
  { key: 'cron', label: 'Cron' },
  { key: 'uuid', label: 'UUID' },
  { key: 'hash', label: 'Hash' },
  { key: 'url', label: 'URL' },
  { key: 'jwt', label: 'JWT' },
]

const st = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } as CSSProperties,
  topBar: { display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'var(--sidebar-bg)', gap: 0 } as CSSProperties,
  tab: (active: boolean) => ({ padding: '12px 18px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text-muted)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }) as CSSProperties,
  content: { flex: 1, overflow: 'auto', padding: 24, maxWidth: 900, margin: '0 auto', width: '100%' } as CSSProperties,
  card: { background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 16 } as CSSProperties,
  label: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block', fontWeight: 500 } as CSSProperties,
  row: { display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end' } as CSSProperties,
  btn: { padding: '8px 18px', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 } as CSSProperties,
  btnOutline: { padding: '8px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' } as CSSProperties,
  mono: { fontFamily: 'var(--mono)', fontSize: 13 } as CSSProperties,
  result: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14, fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' } as CSSProperties,
  error: { color: 'var(--danger)', fontSize: 12, marginTop: 8 } as CSSProperties,
  success: { color: 'var(--success)', fontSize: 12, marginTop: 8 } as CSSProperties,
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'var(--accent-glow)', color: 'var(--accent)', marginRight: 6 } as CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 } as CSSProperties,
  th: { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600 } as CSSProperties,
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 12 } as CSSProperties,
  highlight: { background: 'rgba(6, 182, 212, 0.2)', borderRadius: 2, padding: '0 1px' } as CSSProperties,
  copyBtn: { padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', marginLeft: 8 } as CSSProperties,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('regex')

  return (
    <div style={st.root}>
      <div style={st.topBar}>
        <span style={{ fontWeight: 700, fontSize: 15, marginRight: 24, padding: '12px 0' }}>Dev Utils</span>
        {TABS.map(t => (
          <button key={t.key} style={st.tab(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <div style={st.content}>
        {tab === 'regex' && <RegexTab />}
        {tab === 'cron' && <CronTab />}
        {tab === 'uuid' && <UuidTab />}
        {tab === 'hash' && <HashTab />}
        {tab === 'url' && <UrlTab />}
        {tab === 'jwt' && <JwtTab />}
      </div>
    </div>
  )
}

function RegexTab() {
  const [pattern, setPattern] = useState('')
  const [text, setText] = useState('')
  const [flags, setFlags] = useState('')
  const [result, setResult] = useState<RegexResponse | null>(null)

  const test = useCallback(() => {
    if (!pattern) return
    api.testRegex(pattern, text, flags).then(setResult).catch(() => {})
  }, [pattern, text, flags])

  const highlightedText = result?.valid && result.matches.length > 0 ? buildHighlighted(text, result.matches) : null

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Regex Workbench</h2>
      <div style={st.card}>
        <div style={st.row}>
          <div style={{ flex: 1 }}>
            <label style={st.label}>Pattern</label>
            <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="[a-z]+" style={st.mono} onKeyDown={e => e.key === 'Enter' && test()} />
          </div>
          <div style={{ width: 80 }}>
            <label style={st.label}>Flags</label>
            <input value={flags} onChange={e => setFlags(e.target.value)} placeholder="gim" style={st.mono} />
          </div>
          <button style={st.btn} onClick={test}>Test</button>
        </div>
        <label style={st.label}>Test text</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={6} style={st.mono} placeholder="Paste text to test against..." />
      </div>
      {result && (
        <div style={st.card}>
          {result.error ? (
            <p style={st.error}>{result.error}</p>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={st.badge}>{result.matches.length} match{result.matches.length !== 1 ? 'es' : ''}</span>
              </div>
              {highlightedText && (
                <div style={{ ...st.result, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: highlightedText }} />
              )}
              {result.explanation && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{result.explanation}</div>
              )}
              {result.matches.length > 0 && (
                <table style={st.table}>
                  <thead><tr><th style={st.th}>#</th><th style={st.th}>Match</th><th style={st.th}>Position</th><th style={st.th}>Groups</th></tr></thead>
                  <tbody>
                    {result.matches.map((m, i) => (
                      <tr key={i}>
                        <td style={st.td}>{i + 1}</td>
                        <td style={st.td}>{m.match}</td>
                        <td style={st.td}>{m.start}-{m.end}</td>
                        <td style={st.td}>{m.groups.filter(g => g.index > 0).map(g => g.value).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function buildHighlighted(text: string, matches: { start: number; end: number }[]): string {
  const sorted = [...matches].sort((a, b) => a.start - b.start)
  let result = ''
  let lastEnd = 0
  for (const m of sorted) {
    result += escapeHtml(text.slice(lastEnd, m.start))
    result += `<span style="background:rgba(6,182,212,0.3);border-radius:2px;padding:0 1px">${escapeHtml(text.slice(m.start, m.end))}</span>`
    lastEnd = m.end
  }
  result += escapeHtml(text.slice(lastEnd))
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function CronTab() {
  const [expr, setExpr] = useState('')
  const [count, setCount] = useState(5)
  const [result, setResult] = useState<CronResponse | null>(null)

  const parse = useCallback(() => {
    if (!expr) return
    api.parseCron(expr, count).then(setResult).catch(() => {})
  }, [expr, count])

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Cron / systemd-timer Translator</h2>
      <div style={st.card}>
        <div style={st.row}>
          <div style={{ flex: 1 }}>
            <label style={st.label}>Expression</label>
            <input value={expr} onChange={e => setExpr(e.target.value)} placeholder="*/5 * * * *  or  OnCalendar=daily" style={st.mono} onKeyDown={e => e.key === 'Enter' && parse()} />
          </div>
          <div style={{ width: 80 }}>
            <label style={st.label}>Count</label>
            <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={20} style={st.mono} />
          </div>
          <button style={st.btn} onClick={parse}>Parse</button>
        </div>
      </div>
      {result && (
        <div style={st.card}>
          {result.error ? (
            <p style={st.error}>{result.error}</p>
          ) : (
            <>
              {result.type && <span style={st.badge}>{result.type}</span>}
              <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, marginTop: 4 }}>{result.readable}</p>
              {result.nextExecutions.length > 0 && (
                <>
                  <label style={st.label}>Next executions</label>
                  <div style={st.result}>
                    {result.nextExecutions.map((e, i) => (
                      <div key={i}>{new Date(e).toLocaleString()}</div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function UuidTab() {
  const [count, setCount] = useState(5)
  const [format, setFormat] = useState('uuid4')
  const [values, setValues] = useState<string[]>([])
  const [copied, setCopied] = useState(-1)

  const generate = useCallback(() => {
    api.generateUuid(count, format).then(r => setValues(r.values)).catch(() => {})
  }, [count, format])

  const copy = (v: string, i: number) => {
    navigator.clipboard.writeText(v)
    setCopied(i)
    setTimeout(() => setCopied(-1), 1500)
  }

  const copyAll = () => {
    navigator.clipboard.writeText(values.join('\n'))
    setCopied(-2)
    setTimeout(() => setCopied(-1), 1500)
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>UUID / ULID Generator</h2>
      <div style={st.card}>
        <div style={st.row}>
          <div style={{ width: 120 }}>
            <label style={st.label}>Format</label>
            <select value={format} onChange={e => setFormat(e.target.value)} style={st.mono}>
              <option value="uuid4">UUID v4</option>
              <option value="uuid4-upper">UUID v4 Upper</option>
              <option value="uuid4-no-dashes">UUID no dashes</option>
              <option value="ulid">ULID</option>
            </select>
          </div>
          <div style={{ width: 80 }}>
            <label style={st.label}>Count</label>
            <input type="number" value={count} onChange={e => setCount(Number(e.target.value))} min={1} max={1000} style={st.mono} />
          </div>
          <button style={st.btn} onClick={generate}>Generate</button>
          {values.length > 0 && <button style={st.btnOutline} onClick={copyAll}>{copied === -2 ? 'Copied!' : 'Copy all'}</button>}
        </div>
      </div>
      {values.length > 0 && (
        <div style={st.card}>
          {values.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '4px 0', borderBottom: i < values.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <code style={{ ...st.mono, flex: 1 }}>{v}</code>
              <button style={st.copyBtn} onClick={() => copy(v, i)}>{copied === i ? 'Copied!' : 'Copy'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HashTab() {
  const [text, setText] = useState('')
  const [algo, setAlgo] = useState('sha256')
  const [hash, setHash] = useState('')
  const [compare1, setCompare1] = useState('')
  const [compare2, setCompare2] = useState('')
  const [compareResult, setCompareResult] = useState<boolean | null>(null)

  const compute = useCallback(() => {
    if (!text) return
    api.computeHash(text, algo).then(r => setHash(r.hash)).catch(() => {})
  }, [text, algo])

  const compare = useCallback(() => {
    if (!compare1 || !compare2) return
    api.compareHashes(compare1, compare2).then(r => setCompareResult(r.match)).catch(() => {})
  }, [compare1, compare2])

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Hash & Checksum</h2>
      <div style={st.card}>
        <div style={st.row}>
          <div style={{ width: 140 }}>
            <label style={st.label}>Algorithm</label>
            <select value={algo} onChange={e => setAlgo(e.target.value)} style={st.mono}>
              <option value="md5">MD5</option>
              <option value="sha1">SHA-1</option>
              <option value="sha256">SHA-256</option>
              <option value="sha384">SHA-384</option>
              <option value="sha512">SHA-512</option>
            </select>
          </div>
          <button style={{ ...st.btn, alignSelf: 'flex-end' }} onClick={compute}>Compute</button>
        </div>
        <label style={st.label}>Input text</label>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} style={st.mono} placeholder="Enter text to hash..." />
        {hash && (
          <div style={{ marginTop: 12 }}>
            <label style={st.label}>Result</label>
            <div style={{ ...st.result, display: 'flex', alignItems: 'center' }}>
              <code style={{ flex: 1, wordBreak: 'break-all' }}>{hash}</code>
              <button style={st.copyBtn} onClick={() => navigator.clipboard.writeText(hash)}>Copy</button>
            </div>
          </div>
        )}
      </div>
      <div style={st.card}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Compare checksums</h3>
        <div style={st.row}>
          <div style={{ flex: 1 }}>
            <label style={st.label}>Hash 1</label>
            <input value={compare1} onChange={e => { setCompare1(e.target.value); setCompareResult(null) }} style={st.mono} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={st.label}>Hash 2</label>
            <input value={compare2} onChange={e => { setCompare2(e.target.value); setCompareResult(null) }} style={st.mono} />
          </div>
          <button style={st.btn} onClick={compare}>Compare</button>
        </div>
        {compareResult !== null && (
          <p style={compareResult ? st.success : st.error}>{compareResult ? 'Match!' : 'No match'}</p>
        )}
      </div>
    </div>
  )
}

function UrlTab() {
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
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>URL / Query Parser</h2>
      <div style={st.card}>
        <div style={st.row}>
          <div style={{ flex: 1 }}>
            <label style={st.label}>URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/path?key=value&foo=bar#section" style={st.mono} onKeyDown={e => e.key === 'Enter' && parse()} />
          </div>
          <button style={st.btn} onClick={parse}>Parse</button>
        </div>
      </div>
      {result && result.valid && (
        <div style={st.card}>
          <table style={st.table}>
            <tbody>
              {result.scheme && <tr><td style={{ ...st.td, color: 'var(--text-muted)', width: 100 }}>Scheme</td><td style={st.td}>{result.scheme}</td></tr>}
              {result.host && <tr><td style={{ ...st.td, color: 'var(--text-muted)' }}>Host</td><td style={st.td}>{result.host}</td></tr>}
              {result.port && <tr><td style={{ ...st.td, color: 'var(--text-muted)' }}>Port</td><td style={st.td}>{result.port}</td></tr>}
              {result.path && <tr><td style={{ ...st.td, color: 'var(--text-muted)' }}>Path</td><td style={st.td}>{result.path}</td></tr>}
              {result.fragment && <tr><td style={{ ...st.td, color: 'var(--text-muted)' }}>Fragment</td><td style={st.td}>{result.fragment}</td></tr>}
            </tbody>
          </table>
          {result.queryParams.length > 0 && (
            <>
              <h4 style={{ fontSize: 12, color: 'var(--text-muted)', margin: '12px 0 8px', fontWeight: 600 }}>Query Parameters</h4>
              <table style={st.table}>
                <thead><tr><th style={st.th}>Key</th><th style={st.th}>Value</th></tr></thead>
                <tbody>
                  {result.queryParams.map((p, i) => (
                    <tr key={i}><td style={st.td}>{p.key}</td><td style={st.td}>{p.value}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
      {result && !result.valid && <p style={st.error}>{result.error}</p>}

      <div style={st.card}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>URL Encode / Decode</h3>
        <div style={st.row}>
          <div style={{ flex: 1 }}>
            <input value={encText} onChange={e => setEncText(e.target.value)} placeholder="Text to encode/decode" style={st.mono} onKeyDown={e => e.key === 'Enter' && encode()} />
          </div>
          <select value={encMode} onChange={e => setEncMode(e.target.value as 'encode' | 'decode')} style={{ ...st.mono, width: 100 }}>
            <option value="encode">Encode</option>
            <option value="decode">Decode</option>
          </select>
          <button style={st.btn} onClick={encode}>Go</button>
        </div>
        {encResult && (
          <div style={{ ...st.result, marginTop: 8, display: 'flex', alignItems: 'center' }}>
            <code style={{ flex: 1 }}>{encResult}</code>
            <button style={st.copyBtn} onClick={() => navigator.clipboard.writeText(encResult)}>Copy</button>
          </div>
        )}
      </div>
    </div>
  )
}

function JwtTab() {
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
      const now = new Date()
      parts.push(`Expires: ${exp.toLocaleString()} (${exp > now ? 'valid' : 'EXPIRED'})`)
    }
    if (payload.iat) {
      parts.push(`Issued: ${new Date(Number(payload.iat) * 1000).toLocaleString()}`)
    }
    if (payload.nbf) {
      parts.push(`Not before: ${new Date(Number(payload.nbf) * 1000).toLocaleString()}`)
    }
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
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>JWT Decoder</h2>
      <div style={st.card}>
        <label style={st.label}>JWT Token</label>
        <textarea value={token} onChange={e => setToken(e.target.value)} rows={4} style={st.mono} placeholder="eyJhbGciOiJSUzI1NiIsInR5..." />
        <div style={{ marginTop: 12 }}>
          <button style={st.btn} onClick={decode}>Decode</button>
        </div>
      </div>
      {result && (
        <div style={st.card}>
          {result.error ? (
            <p style={st.error}>{result.error}</p>
          ) : (
            <>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Header</h3>
              <div style={{ ...st.result, marginBottom: 16 }}>{JSON.stringify(result.header, null, 2)}</div>

              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Payload</h3>
              <div style={{ ...st.result, marginBottom: 16 }}>{JSON.stringify(result.payload, null, 2)}</div>

              {result.payload && (
                <>
                  {formatExpiry(result.payload).map((line, i) => (
                    <div key={i} style={{ fontSize: 12, color: line.includes('EXPIRED') ? 'var(--danger)' : 'var(--success)', marginBottom: 4 }}>{line}</div>
                  ))}
                  {extractRoles(result.payload).length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <label style={st.label}>Roles</label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {extractRoles(result.payload).map((r, i) => (
                          <span key={i} style={st.badge}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
