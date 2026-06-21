const BASE = 'http://localhost:10406'

async function req<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface FormatResponse {
  result: string
  valid: boolean
  error: string | null
}

export interface DiffEntry {
  path: string
  type: 'added' | 'removed' | 'changed'
  leftValue: string | null
  rightValue: string | null
}

export interface DiffResponse {
  equal: boolean
  differences: DiffEntry[]
  leftValid: boolean
  rightValid: boolean
  error: string | null
}

export const jsonApi = {
  format: (json: string, indent: number = 2): Promise<FormatResponse> =>
    req('/format', { json, indent }),

  compact: (json: string): Promise<FormatResponse> =>
    req('/compact', { json }),

  diff: (left: string, right: string): Promise<DiffResponse> =>
    req('/diff', { left, right }),
}
