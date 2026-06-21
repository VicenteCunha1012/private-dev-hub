export interface Snippet {
  id: number
  title: string
  command: string
  description: string | null
  tags: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateSnippetRequest {
  title: string
  command: string
  description?: string
  tags?: string
}

export interface UpdateSnippetRequest {
  title?: string
  command?: string
  description?: string
  tags?: string
}

export interface VaultConfig {
  pgDumpPath: string
  psqlPath: string
  pgRestorePath: string
}

const BASE = 'http://localhost:10409'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const vaultApi = {
  // Health
  health: (): Promise<{ status: string }> => req('/health'),

  // Config
  getConfig: (): Promise<VaultConfig> => req('/config'),
  updateConfig: (data: Partial<VaultConfig>): Promise<VaultConfig> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),
  exportConfig: (): Promise<VaultConfig> => req('/config/export'),
  importConfig: (data: VaultConfig): Promise<void> =>
    req('/config/import', { method: 'POST', body: JSON.stringify(data) }),

  // DB export/import
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

  // Snippets
  getSnippets: (search?: string, tag?: string): Promise<Snippet[]> => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tag) params.set('tag', tag)
    const qs = params.toString()
    return req(`/snippets${qs ? `?${qs}` : ''}`)
  },
  getSnippet: (id: number): Promise<Snippet> => req(`/snippets/${id}`),
  createSnippet: (data: CreateSnippetRequest): Promise<Snippet> =>
    req('/snippets', { method: 'POST', body: JSON.stringify(data) }),
  updateSnippet: (id: number, data: UpdateSnippetRequest): Promise<Snippet> =>
    req(`/snippets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSnippet: (id: number): Promise<void> =>
    req(`/snippets/${id}`, { method: 'DELETE' }),
  getTags: (): Promise<string[]> => req('/snippets/tags'),
}
