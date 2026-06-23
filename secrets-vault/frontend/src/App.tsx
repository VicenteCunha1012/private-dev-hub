import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { secretsApi, type SecretEntry, type CryptoConfig } from './api/secretsApi'
import {
  deriveKey, computeVerifier, encryptBlob, decryptBlob,
  randomSaltB64, ITERATIONS, type SecretPlaintext,
} from './crypto'

type AppView = 'loading' | 'setup' | 'locked' | 'unlocked'

export default function App() {
  const [view, setView] = useState<AppView>('loading')
  const [cryptoConfig, setCryptoConfig] = useState<CryptoConfig | null>(null)
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null)
  const [secrets, setSecrets] = useState<SecretEntry[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [decrypted, setDecrypted] = useState<SecretPlaintext | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [pwError, setPwError] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(() => secrets.find(s => s.id === selectedId) ?? null, [secrets, selectedId])

  // Load crypto config on mount
  useEffect(() => {
    secretsApi.getCryptoConfig()
      .then(cfg => {
        setCryptoConfig(cfg)
        setView(cfg.initialized ? 'locked' : 'setup')
      })
      .catch(() => setError('Backend unreachable — make sure secrets-vault backend is running on port 10414.'))
  }, [])

  // Load secrets list (plaintext metadata only)
  const loadSecrets = useCallback(async () => {
    try {
      const list = await secretsApi.getSecrets(search || undefined, categoryFilter || undefined)
      setSecrets(list)
      setError(null)
    } catch {
      setError('Backend unreachable — make sure secrets-vault backend is running on port 10414.')
    }
  }, [search, categoryFilter])

  const loadCategories = useCallback(async () => {
    try { setCategories(await secretsApi.getCategories()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (view === 'unlocked') { loadSecrets(); loadCategories() }
  }, [view, loadSecrets, loadCategories])

  // Decrypt selected secret
  useEffect(() => {
    if (!selected || !cryptoKey) { setDecrypted(null); setRevealed(false); return }
    decryptBlob(cryptoKey, selected.iv, selected.ciphertext)
      .then(pt => { setDecrypted(pt); setRevealed(false) })
      .catch(() => { setDecrypted(null); setError('Failed to decrypt — data may be corrupt.') })
  }, [selected, cryptoKey])

  // Auto-lock on blur / visibility change
  useEffect(() => {
    const lock = () => {
      if (cryptoKey) {
        setCryptoKey(null)
        setDecrypted(null)
        setRevealed(false)
        setShowCreate(false)
        setShowEdit(false)
        setChangingPw(false)
        setView('locked')
      }
    }
    const onVisChange = () => { if (document.hidden) lock() }
    window.addEventListener('blur', lock)
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      window.removeEventListener('blur', lock)
      document.removeEventListener('visibilitychange', onVisChange)
    }
  }, [cryptoKey])

  // --- Handlers ---

  const handleSetup = async (password: string) => {
    const kdfSalt = randomSaltB64()
    const verifySalt = randomSaltB64()
    const key = await deriveKey(password, kdfSalt, ITERATIONS)
    const verifier = await computeVerifier(key, verifySalt)
    const cfg = await secretsApi.updateCryptoConfig({
      kdfSalt, verifySalt, verifier, iterations: ITERATIONS,
    })
    setCryptoConfig(cfg)
    setCryptoKey(key)
    setView('unlocked')
  }

  const handleUnlock = async (password: string) => {
    if (!cryptoConfig?.kdfSalt || !cryptoConfig.verifySalt || !cryptoConfig.verifier) return
    setPwError('')
    try {
      const key = await deriveKey(password, cryptoConfig.kdfSalt, cryptoConfig.iterations ?? ITERATIONS)
      const v = await computeVerifier(key, cryptoConfig.verifySalt)
      if (v !== cryptoConfig.verifier) { setPwError('Wrong password'); return }
      setCryptoKey(key)
      setView('unlocked')
    } catch {
      setPwError('Decryption error')
    }
  }

  const handleLock = () => {
    setCryptoKey(null)
    setDecrypted(null)
    setRevealed(false)
    setShowCreate(false)
    setShowEdit(false)
    setChangingPw(false)
    setView('locked')
  }

  const handleCreate = async (label: string, category: string, tags: string, pt: SecretPlaintext) => {
    if (!cryptoKey) return
    const { iv, ciphertext } = await encryptBlob(cryptoKey, pt)
    await secretsApi.createSecret({ label, category: category || undefined, tags: tags || undefined, iv, ciphertext })
    setShowCreate(false)
    loadSecrets()
    loadCategories()
  }

  const handleUpdate = async (label: string, category: string, tags: string, pt: SecretPlaintext) => {
    if (!cryptoKey || !selectedId) return
    const { iv, ciphertext } = await encryptBlob(cryptoKey, pt)
    await secretsApi.updateSecret(selectedId, { label, category, tags, iv, ciphertext })
    setShowEdit(false)
    loadSecrets()
    loadCategories()
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!confirm('Delete this secret permanently?')) return
    await secretsApi.deleteSecret(selectedId)
    setSelectedId(null)
    loadSecrets()
    loadCategories()
  }

  const handleCopy = (text: string, what: string) => {
    navigator.clipboard.writeText(text)
    setCopyFeedback(what)
    setTimeout(() => setCopyFeedback(null), 1500)
  }

  const handleChangePassword = async (oldPw: string, newPw: string) => {
    if (!cryptoConfig?.kdfSalt || !cryptoConfig.verifySalt || !cryptoConfig.verifier) return
    setPwError('')
    try {
      const oldKey = await deriveKey(oldPw, cryptoConfig.kdfSalt, cryptoConfig.iterations ?? ITERATIONS)
      const oldV = await computeVerifier(oldKey, cryptoConfig.verifySalt)
      if (oldV !== cryptoConfig.verifier) { setPwError('Current password is wrong'); return }

      const newKdfSalt = randomSaltB64()
      const newVerifySalt = randomSaltB64()
      const newKey = await deriveKey(newPw, newKdfSalt, ITERATIONS)
      const newVerifier = await computeVerifier(newKey, newVerifySalt)

      const allSecrets = await secretsApi.getSecrets()
      for (const s of allSecrets) {
        const pt = await decryptBlob(oldKey, s.iv, s.ciphertext)
        const { iv, ciphertext } = await encryptBlob(newKey, pt)
        await secretsApi.updateSecret(s.id, { iv, ciphertext })
      }

      const cfg = await secretsApi.updateCryptoConfig({
        kdfSalt: newKdfSalt, verifySalt: newVerifySalt, verifier: newVerifier, iterations: ITERATIONS,
      })
      setCryptoConfig(cfg)
      setCryptoKey(newKey)
      setChangingPw(false)
      loadSecrets()
    } catch {
      setPwError('Failed to change password')
    }
  }

  // --- Render ---

  if (view === 'loading') return <CenterBox><p style={{ color: V.textMuted }}>Loading...</p></CenterBox>
  if (view === 'setup') return <SetupScreen onSetup={handleSetup} />
  if (view === 'locked') return <LockScreen onUnlock={handleUnlock} error={pwError} />

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)', borderRight: `1px solid ${V.border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 16px 12px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: `1px solid ${V.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔐</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Secrets Vault</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setChangingPw(true)} title="Change password"
              style={iconBtnStyle}>⚙</button>
            <button onClick={handleLock} title="Lock vault"
              style={iconBtnStyle}>🔒</button>
            <button onClick={() => { setShowCreate(true); setShowEdit(false) }} title="New secret"
              style={{ ...iconBtnStyle, color: V.accent, fontWeight: 700, fontSize: 18 }}>+</button>
          </div>
        </div>

        <div style={{ padding: '8px 12px' }}>
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search secrets..." style={{ width: '100%', fontSize: 12 }} />
        </div>

        {categories.length > 0 && (
          <div style={{ padding: '0 12px 8px' }}>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {secrets.length === 0 && (
            <div style={{ color: V.textDim, fontSize: 12, textAlign: 'center', padding: 20 }}>
              No secrets found
            </div>
          )}
          {secrets.map(s => (
            <button key={s.id} onClick={() => { setSelectedId(s.id); setShowCreate(false); setShowEdit(false); setChangingPw(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px',
                background: s.id === selectedId ? V.cardHover : 'transparent',
                borderRadius: V.radius, color: V.text, fontSize: 13, marginBottom: 2,
                border: s.id === selectedId ? `1px solid ${V.accent}` : '1px solid transparent',
              }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
              {s.category && <div style={{ fontSize: 11, color: V.textMuted }}>{s.category}</div>}
              {s.tags && <div style={{ fontSize: 10, color: V.textDim, marginTop: 2 }}>
                {s.tags.split(',').map(t => t.trim()).filter(Boolean).map(t =>
                  <span key={t} style={tagStyle}>{t}</span>
                )}
              </div>}
            </button>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: 24 }}>
        {error && <div style={errorBannerStyle}>{error}</div>}

        {copyFeedback && (
          <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 100,
            background: V.accent, color: '#fff', padding: '8px 16px',
            borderRadius: V.radius, fontSize: 13, fontWeight: 600,
          }}>
            Copied {copyFeedback}
          </div>
        )}

        {changingPw && (
          <ChangePasswordForm onSubmit={handleChangePassword} onCancel={() => { setChangingPw(false); setPwError('') }} error={pwError} />
        )}

        {showCreate && !changingPw && (
          <SecretForm title="New Secret" onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
        )}

        {showEdit && selected && decrypted && !changingPw && (
          <SecretForm title="Edit Secret" initial={{ label: selected.label, category: selected.category ?? '', tags: selected.tags ?? '', ...decrypted }}
            onSubmit={handleUpdate} onCancel={() => setShowEdit(false)} />
        )}

        {!showCreate && !showEdit && !changingPw && !selected && (
          <CenterBox>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.2 }}>🔐</div>
            <div style={{ color: V.textDim, fontSize: 14 }}>Select a secret or create a new one</div>
          </CenterBox>
        )}

        {!showCreate && !showEdit && !changingPw && selected && decrypted && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>{selected.label}</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowEdit(true)} style={actionBtnStyle}>Edit</button>
                <button onClick={handleDelete} style={{ ...actionBtnStyle, color: V.danger, borderColor: V.danger }}>Delete</button>
              </div>
            </div>

            {selected.category && (
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: V.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Category</span>
                <div style={{ fontSize: 14, marginTop: 2 }}>{selected.category}</div>
              </div>
            )}

            {selected.tags && (
              <div style={{ marginBottom: 16 }}>
                {selected.tags.split(',').map(t => t.trim()).filter(Boolean).map(t =>
                  <span key={t} style={{ ...tagStyle, marginRight: 6 }}>{t}</span>
                )}
              </div>
            )}

            <div style={{ background: V.cardBg, borderRadius: V.radius, padding: 20, border: `1px solid ${V.border}` }}>
              {/* Value */}
              <FieldRow label="Value">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontFamily: 'var(--mono)', fontSize: 14, flex: 1, wordBreak: 'break-all' }}>
                    {revealed ? decrypted.value : '••••••••••••'}
                  </code>
                  <button onClick={() => setRevealed(!revealed)} style={smallBtnStyle}>
                    {revealed ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => handleCopy(decrypted.value, 'value')} style={smallBtnStyle}>Copy</button>
                </div>
              </FieldRow>

              {/* Username */}
              {decrypted.username && (
                <FieldRow label="Username">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontFamily: 'var(--mono)', fontSize: 14, flex: 1 }}>{decrypted.username}</code>
                    <button onClick={() => handleCopy(decrypted.username!, 'username')} style={smallBtnStyle}>Copy</button>
                  </div>
                </FieldRow>
              )}

              {/* URL */}
              {decrypted.url && (
                <FieldRow label="URL">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ fontFamily: 'var(--mono)', fontSize: 14, flex: 1, wordBreak: 'break-all' }}>{decrypted.url}</code>
                    <button onClick={() => handleCopy(decrypted.url!, 'URL')} style={smallBtnStyle}>Copy</button>
                  </div>
                </FieldRow>
              )}

              {/* Notes */}
              {decrypted.notes && (
                <FieldRow label="Notes">
                  <div style={{ fontSize: 13, color: V.textMuted, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {decrypted.notes}
                  </div>
                </FieldRow>
              )}
            </div>

            <div style={{ marginTop: 12, fontSize: 11, color: V.textDim }}>
              Created {selected.createdAt?.slice(0, 19).replace('T', ' ')} · Updated {selected.updatedAt?.slice(0, 19).replace('T', ' ')}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// --- Sub-components ---

const V = {
  border: 'var(--border)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  textDim: 'var(--text-dim)',
  accent: 'var(--accent)',
  danger: 'var(--danger)',
  cardBg: 'var(--card-bg)',
  cardHover: 'var(--card-hover)',
  radius: 'var(--radius)',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: V.textMuted, fontSize: 16,
  cursor: 'pointer', padding: '4px 6px', borderRadius: 4,
}

const actionBtnStyle: React.CSSProperties = {
  background: 'transparent', border: `1px solid ${V.accent}`, color: V.accent,
  padding: '6px 16px', borderRadius: V.radius, fontSize: 13, fontWeight: 600,
}

const smallBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', color: V.textMuted, border: 'none',
  padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, flexShrink: 0,
}

const tagStyle: React.CSSProperties = {
  display: 'inline-block', background: 'rgba(20,184,166,0.12)', color: V.accent,
  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4, marginRight: 4,
}

const errorBannerStyle: React.CSSProperties = {
  padding: '10px 16px', marginBottom: 16, background: '#2a0f0f',
  border: '1px solid rgba(248,113,113,0.2)', borderRadius: V.radius,
  color: V.danger, fontSize: 13,
}

function CenterBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: V.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

// --- Setup Screen ---

function SetupScreen({ onSetup }: { onSetup: (pw: string) => void }) {
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (pw.length < 4) { setErr('Password must be at least 4 characters'); return }
    if (pw !== confirm) { setErr('Passwords do not match'); return }
    setLoading(true)
    try { await onSetup(pw) } catch { setErr('Setup failed') }
    setLoading(false)
  }

  return (
    <CenterBox>
      <div style={{ maxWidth: 380, width: '100%', padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔐</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Secrets Vault Setup</h1>
          <p style={{ color: V.textMuted, fontSize: 13 }}>
            Create a master password. All secrets will be encrypted with this password.
          </p>
          <p style={{ color: V.danger, fontSize: 12, marginTop: 8, fontWeight: 600 }}>
            There is no password recovery. If you forget it, all secrets are lost.
          </p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input type="password" placeholder="Master password" value={pw}
            onChange={e => setPw(e.target.value)} style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input type="password" placeholder="Confirm password" value={confirm}
            onChange={e => setConfirm(e.target.value)} style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {err && <div style={{ color: V.danger, fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <button onClick={submit} disabled={loading}
          style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
            background: V.accent, color: '#fff', borderRadius: V.radius,
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Setting up...' : 'Create Vault'}
        </button>
      </div>
    </CenterBox>
  )
}

// --- Lock Screen ---

function LockScreen({ onUnlock, error }: { onUnlock: (pw: string) => void; error: string }) {
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = async () => {
    if (!pw) return
    setLoading(true)
    try { await onUnlock(pw) } catch { /* handled via error prop */ }
    setLoading(false)
  }

  return (
    <CenterBox>
      <div style={{ maxWidth: 340, width: '100%', padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Vault Locked</h1>
          <p style={{ color: V.textMuted, fontSize: 13, marginTop: 4 }}>Enter your master password</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <input ref={inputRef} type="password" placeholder="Master password" value={pw}
            onChange={e => setPw(e.target.value)} style={{ width: '100%' }}
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {error && <div style={{ color: V.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button onClick={submit} disabled={loading}
          style={{
            width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
            background: V.accent, color: '#fff', borderRadius: V.radius,
            opacity: loading ? 0.6 : 1,
          }}>
          {loading ? 'Unlocking...' : 'Unlock'}
        </button>
      </div>
    </CenterBox>
  )
}

// --- Secret Form (Create / Edit) ---

interface SecretFormProps {
  title: string
  initial?: { label: string; category: string; tags: string; value: string; username?: string; url?: string; notes?: string }
  onSubmit: (label: string, category: string, tags: string, pt: SecretPlaintext) => Promise<void>
  onCancel: () => void
}

function SecretForm({ title, initial, onSubmit, onCancel }: SecretFormProps) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [tags, setTags] = useState(initial?.tags ?? '')
  const [value, setValue] = useState(initial?.value ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!label.trim()) { setErr('Label is required'); return }
    if (!value.trim()) { setErr('Value is required'); return }
    setLoading(true)
    setErr('')
    try {
      await onSubmit(label.trim(), category.trim(), tags.trim(), {
        value: value.trim(),
        username: username.trim() || undefined,
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    } catch { setErr('Failed to save') }
    setLoading(false)
  }

  const fieldStyle: React.CSSProperties = { width: '100%', marginBottom: 12 }

  return (
    <div style={{ maxWidth: 500 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{title}</h2>
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Label *</div>
      <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. GitHub Token" style={fieldStyle} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Category</div>
      <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. API Keys" style={fieldStyle} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Tags (comma-separated)</div>
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. github, dev" style={fieldStyle} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Value / Secret *</div>
      <textarea value={value} onChange={e => setValue(e.target.value)} placeholder="The secret value"
        rows={3} style={{ ...fieldStyle, fontFamily: 'var(--mono)', resize: 'vertical' }} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Username</div>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Optional" style={fieldStyle} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>URL</div>
      <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Optional" style={fieldStyle} />
      <div style={{ marginBottom: 4, fontSize: 12, color: V.textMuted }}>Notes</div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes"
        rows={3} style={{ ...fieldStyle, resize: 'vertical' }} />
      {err && <div style={{ color: V.danger, fontSize: 12, marginBottom: 12 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={loading}
          style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700, background: V.accent, color: '#fff', borderRadius: V.radius }}>
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '10px 24px', fontSize: 14, background: 'transparent', color: V.textMuted, border: `1px solid ${V.border}`, borderRadius: V.radius }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// --- Change Password Form ---

function ChangePasswordForm({ onSubmit, onCancel, error }: {
  onSubmit: (oldPw: string, newPw: string) => Promise<void>; onCancel: () => void; error: string
}) {
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (newPw.length < 4) { setErr('New password must be at least 4 characters'); return }
    if (newPw !== confirmPw) { setErr('New passwords do not match'); return }
    setLoading(true); setErr('')
    try { await onSubmit(oldPw, newPw) } catch { setErr('Failed') }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 380 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Change Master Password</h2>
      <p style={{ color: V.danger, fontSize: 12, marginBottom: 16, fontWeight: 600 }}>
        All secrets will be re-encrypted with the new password.
      </p>
      <input type="password" placeholder="Current password" value={oldPw}
        onChange={e => setOldPw(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      <input type="password" placeholder="New password" value={newPw}
        onChange={e => setNewPw(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      <input type="password" placeholder="Confirm new password" value={confirmPw}
        onChange={e => setConfirmPw(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      {(err || error) && <div style={{ color: V.danger, fontSize: 12, marginBottom: 12 }}>{err || error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={loading}
          style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700, background: V.accent, color: '#fff', borderRadius: V.radius }}>
          {loading ? 'Changing...' : 'Change Password'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '10px 24px', fontSize: 14, background: 'transparent', color: V.textMuted, border: `1px solid ${V.border}`, borderRadius: V.radius }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
