export interface SecretEntry {
  id: number
  label: string
  category: string | null
  tags: string | null
  iv: string
  ciphertext: string
  createdAt: string
  updatedAt: string
}

export interface CreateSecretRequest {
  label: string
  category?: string
  tags?: string
  iv: string
  ciphertext: string
}

export interface UpdateSecretRequest {
  label?: string
  category?: string
  tags?: string
  iv?: string
  ciphertext?: string
}

export interface CryptoConfig {
  kdfSalt: string | null
  verifySalt: string | null
  verifier: string | null
  iterations: number | null
  initialized: boolean
}

export interface UpdateCryptoConfigRequest {
  kdfSalt?: string
  verifySalt?: string
  verifier?: string
  iterations?: number
}

const BASE = 'http://localhost:10414'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const secretsApi = {
  health: (): Promise<{ status: string }> => req('/health'),

  getCryptoConfig: (): Promise<CryptoConfig> => req('/config'),
  updateCryptoConfig: (data: UpdateCryptoConfigRequest): Promise<CryptoConfig> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),

  exportDb: async (): Promise<string> => {
    const res = await fetch(`${BASE}/db/export`)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.text()
  },
  importDb: async (sql: string): Promise<void> => {
    const res = await fetch(`${BASE}/db/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: sql,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  },

  getSecrets: (search?: string, category?: string): Promise<SecretEntry[]> => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (category) params.set('category', category)
    const qs = params.toString()
    return req(`/secrets${qs ? `?${qs}` : ''}`)
  },
  getSecret: (id: number): Promise<SecretEntry> => req(`/secrets/${id}`),
  createSecret: (data: CreateSecretRequest): Promise<SecretEntry> =>
    req('/secrets', { method: 'POST', body: JSON.stringify(data) }),
  updateSecret: (id: number, data: UpdateSecretRequest): Promise<SecretEntry> =>
    req(`/secrets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSecret: (id: number): Promise<void> =>
    req(`/secrets/${id}`, { method: 'DELETE' }),
  getCategories: (): Promise<string[]> => req('/secrets/categories'),
}
