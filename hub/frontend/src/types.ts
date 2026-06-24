export type EntryType = 'redirect' | 'tui' | 'tool'

export interface Entry {
  id: number
  label: string
  url?: string
  type: EntryType
  folderId?: number
  position: number
  workdir?: string
  command?: string
  emoji?: string
}

export interface Folder {
  id: number
  name: string
  position: number
  parentId?: number | null
  entries: Entry[]
  children?: Folder[]
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

export interface PaletteConfig {
  preset: string
  customAccent?: string
  customAccent2?: string
  customBg?: string
}

export const DEFAULT_PALETTE: PaletteConfig = { preset: 'midnight' }

export interface HubConfig {
  pgDumpPath: string
  psqlPath: string
  pgRestorePath: string
  keybinds: KeybindsConfig
  palette?: PaletteConfig
}

export interface ExportedConfig {
  version: string
  exportedAt: string
  config: HubConfig
  folders: Folder[]
}
