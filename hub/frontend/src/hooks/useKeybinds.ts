import { type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect } from 'react'
import type { Entry, KeybindsConfig } from '../types'

export interface KeybindHandlers {
  goHome: () => void
  focusSearch: () => void
  navUp: () => void
  navDown: () => void
  openSettings: () => void
  openEntry: (entry: Entry) => void
}

function eventToKey(e: KeyboardEvent | ReactKeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  const k = e.key
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(k)) parts.push(k)
  return parts.join('+')
}

function makeHandler(
  config: KeybindsConfig,
  allEntries: Entry[],
  handlers: KeybindHandlers
) {
  return (e: KeyboardEvent | ReactKeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if ((e.target as HTMLElement).tagName === 'IFRAME') return

    const key = eventToKey(e)

    if (key === config.goHome) { e.preventDefault(); handlers.goHome(); return }
    if (key === config.focusSearch) { e.preventDefault(); handlers.focusSearch(); return }
    if (key === config.navUp) { e.preventDefault(); handlers.navUp(); return }
    if (key === config.navDown) { e.preventDefault(); handlers.navDown(); return }
    if (key === config.openSettings) { e.preventDefault(); handlers.openSettings(); return }

    const validShortcuts = config.entryShortcuts.filter(s => s.entryId > 0 && s.shortcut.length > 0)
    const custom = validShortcuts.find(s => s.shortcut === key)
    if (custom) {
      const entry = allEntries.find(e => e.id === custom.entryId)
      if (entry) { e.preventDefault(); handlers.openEntry(entry) }
      return
    }

    if (/^\d$/.test(key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const n = parseInt(key, 10)
      if (n >= 1 && n <= allEntries.length) {
        e.preventDefault()
        handlers.openEntry(allEntries[n - 1])
      }
    }
  }
}

export function useKeybinds(
  config: KeybindsConfig,
  allEntries: Entry[],
  handlers: KeybindHandlers
) {
  // window-level listener (works in most browsers)
  useEffect(() => {
    const handle = makeHandler(config, allEntries, handlers) as (e: KeyboardEvent) => void
    window.addEventListener('keydown', handle, true)
    document.addEventListener('keydown', handle, true)
    return () => {
      window.removeEventListener('keydown', handle, true)
      document.removeEventListener('keydown', handle, true)
    }
  }, [config, allEntries, handlers])

  // React onKeyDown handler (fallback via event bubbling)
  return useCallback(
    makeHandler(config, allEntries, handlers) as (e: ReactKeyboardEvent) => void,
    [config, allEntries, handlers]
  )
}
