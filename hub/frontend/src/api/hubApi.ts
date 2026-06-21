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

  // Health
  health: (): Promise<{ status: string }> => req('/health'),
}
