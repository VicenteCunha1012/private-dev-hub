import { type ReactNode, useState } from 'react'

interface JsonViewerProps {
  data: string | null
  maxHeight?: number
  collapseThreshold?: number
}

export default function JsonViewer({ data, maxHeight = 400, collapseThreshold = 500 }: JsonViewerProps) {
  const [expanded, setExpanded] = useState(false)

  if (data === null) return <span style={{ color: 'var(--json-null)' }}>null</span>

  let parsed: unknown
  let isJson = false
  try {
    parsed = JSON.parse(data)
    isJson = true
  } catch {
    parsed = data
  }

  if (!isJson) {
    return (
      <pre style={{
        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        fontSize: 12, lineHeight: 1.5, color: 'var(--text)',
      }}>
        {data}
      </pre>
    )
  }

  const formatted = JSON.stringify(parsed, null, 2)
  const isLarge = formatted.length > collapseThreshold

  return (
    <div>
      {isLarge && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            fontSize: 11, color: 'var(--accent)', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 4L5 6L7 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Expand ({(formatted.length / 1024).toFixed(1)} KB)
        </button>
      )}
      {isLarge && expanded && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            fontSize: 11, color: 'var(--accent)', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 6L5 4L7 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Collapse
        </button>
      )}
      <pre style={{
        margin: 0,
        maxHeight: isLarge && !expanded ? 80 : maxHeight,
        overflow: 'auto',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        <JsonHighlight json={formatted} />
      </pre>
    </div>
  )
}

function JsonHighlight({ json }: { json: string }) {
  const parts = json.split(/("(?:[^"\\]|\\.)*")\s*:/g)
  const result: ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (i % 2 === 1) {
      result.push(<span key={i} style={{ color: 'var(--json-key)' }}>{part}</span>)
      result.push(<span key={`${i}c`}>:</span>)
    } else {
      result.push(<span key={i}>{colorizeValues(part)}</span>)
    }
  }

  return <>{result}</>
}

function colorizeValues(text: string): ReactNode[] {
  const regex = /("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(true|false)|(null)/g
  const result: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>)
    }
    if (match[1]) {
      result.push(<span key={key++} style={{ color: 'var(--json-string)' }}>{match[0]}</span>)
    } else if (match[2]) {
      result.push(<span key={key++} style={{ color: 'var(--json-number)' }}>{match[0]}</span>)
    } else if (match[3]) {
      result.push(<span key={key++} style={{ color: 'var(--json-boolean)' }}>{match[0]}</span>)
    } else if (match[4]) {
      result.push(<span key={key++} style={{ color: 'var(--json-null)' }}>{match[0]}</span>)
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push(<span key={key++}>{text.slice(lastIndex)}</span>)
  }

  return result
}
