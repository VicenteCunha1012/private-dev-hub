import { useState } from 'react'
import { api } from '../api/hubApi'
import type { Entry } from '../types'

interface EntryIconProps {
  entry: Entry
  size?: number
}

const typeEmoji: Record<string, string> = {
  redirect: '↗',
  tui: '>_',
  tool: '⚙',
}

export default function EntryIcon({ entry, size = 20 }: EntryIconProps) {
  const [failed, setFailed] = useState(false)

  if (entry.emoji) {
    return (
      <span style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.85, flexShrink: 0, lineHeight: 1,
      }}>
        {entry.emoji}
      </span>
    )
  }

  if (failed || !entry.url) {
    return (
      <span style={{
        width: size, height: size, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', fontSize: size * 0.6, color: 'var(--text-muted)',
        flexShrink: 0,
      }}>
        {typeEmoji[entry.type] ?? '⚙'}
      </span>
    )
  }

  return (
    <img
      src={api.getIconUrl(entry.id)}
      width={size}
      height={size}
      alt=""
      onError={() => setFailed(true)}
      style={{ borderRadius: 3, objectFit: 'contain', flexShrink: 0 }}
    />
  )
}
