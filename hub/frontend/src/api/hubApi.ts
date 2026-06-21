import type { Entry, ExportedConfig, Folder, HubConfig, KeybindsConfig } from '../types'

const BASE = 'http://localhost:10303'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // Folders
  getFolders: (): Promise<Folder[]> => req('/folders'),
  createFolder: (name: string): Promise<Folder> =>
    req('/folders', { method: 'POST', body: JSON.stringify({ name }) }),
  updateFolder: (id: number, data: { name?: string; position?: number }): Promise<Folder> =>
    req(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id: number): Promise<void> =>
    req(`/folders/${id}`, { method: 'DELETE' }),

  // Entries
  getEntries: (): Promise<Entry[]> => req('/entries'),
  createEntry: (data: Omit<Entry, 'id'>): Promise<Entry> =>
    req('/entries', { method: 'POST', body: JSON.stringify(data) }),
  updateEntry: (id: number, data: Partial<Entry>): Promise<Entry> =>
    req(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntry: (id: number): Promise<void> =>
    req(`/entries/${id}`, { method: 'DELETE' }),

  // Icons
  getIconUrl: (id: number): string => `${BASE}/entries/${id}/icon`,
  setIconFromUrl: (id: number, iconUrl: string): Promise<void> =>
    req(`/entries/${id}/icon`, { method: 'POST', body: JSON.stringify({ url: iconUrl }) }),
  deleteIcon: (id: number): Promise<void> =>
    req(`/entries/${id}/icon`, { method: 'DELETE' }),
  refreshIcon: (id: number): Promise<void> =>
    req(`/entries/${id}/icon/refresh`, { method: 'POST' }),

  // Config
  getConfig: (): Promise<HubConfig> => req('/config'),
  updateConfig: (data: Partial<HubConfig> & { keybinds?: KeybindsConfig }): Promise<HubConfig> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),
  exportConfig: (): Promise<ExportedConfig> => req('/config/export'),
  importConfig: (data: ExportedConfig): Promise<void> =>
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

  // Backups
  getBackups: (): Promise<{ filename: string; timestamp: string; sizeBytes: number }[]> => req('/backups'),
  runBackup: (): Promise<{ filename: string; timestamp: string; sizeBytes: number }> =>
    req('/backups/run', { method: 'POST' }),
  getBackupConfig: (): Promise<{ enabled: boolean; intervalMinutes: number; path: string; retention: number }> =>
    req('/backups/config'),
  updateBackupConfig: (data: { enabled?: boolean; intervalMinutes?: number; path?: string; retention?: number }): Promise<{ enabled: boolean; intervalMinutes: number; path: string; retention: number }> =>
    req('/backups/config', { method: 'POST', body: JSON.stringify(data) }),

  // Health
  health: (): Promise<{ status: string }> => req('/health'),
}

// ── Kafbat+ API ──────────────────────────────────────────────────────────────

const KAFBAT_BASE = 'http://localhost:10401'

export interface KafbatConfig {
  brokers: string
  defaultLimit: string
}

export interface KafbatCluster {
  id: number
  name: string
  brokers: string
  isDefault: boolean
}

export const kafbatApi = {
  getConfig: async (): Promise<KafbatConfig> => {
    const res = await fetch(`${KAFBAT_BASE}/config`)
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
    return res.json()
  },
  updateConfig: async (data: KafbatConfig): Promise<KafbatConfig> => {
    const res = await fetch(`${KAFBAT_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
    return res.json()
  },
  getClusters: async (): Promise<KafbatCluster[]> => {
    const res = await fetch(`${KAFBAT_BASE}/clusters`)
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
    return res.json()
  },
  createCluster: async (name: string, brokers: string): Promise<KafbatCluster> => {
    const res = await fetch(`${KAFBAT_BASE}/clusters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brokers }),
    })
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
    return res.json()
  },
  updateCluster: async (id: number, name: string, brokers: string): Promise<KafbatCluster> => {
    const res = await fetch(`${KAFBAT_BASE}/clusters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brokers }),
    })
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
    return res.json()
  },
  deleteCluster: async (id: number): Promise<void> => {
    const res = await fetch(`${KAFBAT_BASE}/clusters/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`kafbat: ${res.status} ${res.statusText}`)
  },
}

// ── ttyd-manager API ──────────────────────────────────────────────────────────

const TTYD_BASE = 'http://localhost:10600'

async function ttydReq<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${TTYD_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) throw new Error(`ttyd-manager: ${res.status} ${res.statusText}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface TuiSession {
  id: string
  name: string
  workdir: string
  command: string
  port: number
  url: string
}

export const ttydApi = {
  list: (): Promise<TuiSession[]> => ttydReq('/tuis'),
  create: (name: string, workdir: string, command: string): Promise<TuiSession> =>
    ttydReq('/tuis', { method: 'POST', body: JSON.stringify({ name, workdir, command }) }),
  delete: (id: string): Promise<void> =>
    ttydReq(`/tuis/${id}`, { method: 'DELETE' }),
}
