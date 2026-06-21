import type { Entry } from '../types'

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  return 'https://' + url
}

interface IframeAreaProps {
  entries: Entry[]
  selectedId: number | null
}

export default function IframeArea({ entries, selectedId }: IframeAreaProps) {
  const iframeEntries = entries.filter(e => e.url)

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {iframeEntries.map(entry => (
        <iframe
          key={entry.id}
          src={normalizeUrl(entry.url!)}
          title={entry.label}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            display: selectedId === entry.id ? 'block' : 'none',
          }}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        />
      ))}
    </div>
  )
}
