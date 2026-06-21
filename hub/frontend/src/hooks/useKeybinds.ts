import { useEffect } from 'react'
import type { Entry, KeybindsConfig } from '../types'

export interface KeybindHandlers {
  goHome: () => void
  focusSearch: () => void
  navUp: () => void
  navDown: () => void
  openSettings: () => void
  openEntry: (entry: Entry) => void
}

function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  // Normalise: bare modifier presses have no key suffix
  const k = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(k)) parts.push(k)
  return parts.join('+')
}

export function useKeybinds(
  config: KeybindsConfig,
  allEntries: Entry[],
  handlers: KeybindHandlers
) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      // Don't fire when typing in a form element
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = eventToKey(e)

      if (key === config.goHome) { e.preventDefault(); handlers.goHome(); return }
      if (key === config.focusSearch) { e.preventDefault(); handlers.focusSearch(); return }
      if (key === config.navUp) { e.preventDefault(); handlers.navUp(); return }
      if (key === config.navDown) { e.preventDefault(); handlers.navDown(); return }
      if (key === config.openSettings) { e.preventDefault(); handlers.openSettings(); return }

      // Per-entry shortcuts — filter out invalid/incomplete entries first
      const validShortcuts = config.entryShortcuts.filter(s => s.entryId > 0 && s.shortcut.length > 0)
      const custom = validShortcuts.find(s => s.shortcut === key)
      if (custom) {
        const entry = allEntries.find(e => e.id === custom.entryId)
        if (entry) { e.preventDefault(); handlers.openEntry(entry) }
        return
      }

      // Default: digits 1–9 open the Nth entry (by order in the flat list)
      if (/^\d$/.test(key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const n = parseInt(key, 10)
        if (n >= 1 && n <= allEntries.length) {
          e.preventDefault()
          handlers.openEntry(allEntries[n - 1])
        }
      }
    }

    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [config, allEntries, handlers])
}
