export type EntryType = 'redirect' | 'tui' | 'tool'

export interface Entry {
  id: number
  label: string
  url?: string
  type: EntryType
  folderId?: number
  position: number
}

export interface Folder {
  id: number
  name: string
  position: number
  entries: Entry[]
}

export interface EntryShortcut {
  entryId: number
  shortcut: string
}

export interface KeybindsConfig {
  goHome: string
  focusSearch: string
  navUp: string
  navDown: string
  openSettings: string
  entryShortcuts: EntryShortcut[]
}

export const DEFAULT_KEYBINDS: KeybindsConfig = {
  goHome: 'Escape',
  focusSearch: '/',
  navUp: 'ArrowUp',
  navDown: 'ArrowDown',
  openSettings: ',',
  entryShortcuts: [],
}

export interface HubConfig {
  pgDumpPath: string
  psqlPath: string
  pgRestorePath: string
  keybinds: KeybindsConfig
}

export interface ExportedConfig {
  version: string
  exportedAt: string
  config: HubConfig
  folders: Folder[]
}
