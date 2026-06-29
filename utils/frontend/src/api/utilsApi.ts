const BASE = 'http://localhost:10416'

async function req<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, body ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface RegexMatch { match: string; start: number; end: number; groups: { index: number; name?: string; value?: string }[] }
export interface RegexResponse { valid: boolean; matches: RegexMatch[]; error?: string; explanation?: string }
export interface CronResponse { valid: boolean; readable?: string; nextExecutions: string[]; error?: string; type?: string }
export interface UuidResponse { values: string[] }
export interface HashResponse { hash: string; algorithm: string }
export interface UrlParseResponse { valid: boolean; scheme?: string; host?: string; port?: number; path?: string; query?: string; fragment?: string; queryParams: { key: string; value: string }[]; error?: string }
export interface JwtDecodeResponse { valid: boolean; header?: Record<string, unknown>; payload?: Record<string, unknown>; error?: string }

export const api = {
  testRegex: (pattern: string, text: string, flags: string) =>
    req<RegexResponse>('/regex/test', { pattern, text, flags }),
  parseCron: (expression: string, count = 5) =>
    req<CronResponse>('/cron/parse', { expression, count }),
  generateUuid: (count: number, format: string) =>
    req<UuidResponse>('/uuid/generate', { count, format }),
  computeHash: (text: string, algorithm: string) =>
    req<HashResponse>('/hash/compute', { text, algorithm }),
  compareHashes: (hash1: string, hash2: string) =>
    req<{ match: boolean }>('/hash/compare', { hash1, hash2 }),
  parseUrl: (url: string) =>
    req<UrlParseResponse>('/url/parse', { url }),
  encodeUrl: (text: string, decode: boolean) =>
    req<{ result: string }>('/url/encode', { text, decode }),
  decodeJwt: (token: string) =>
    req<JwtDecodeResponse>('/jwt/decode', { token }),
}
