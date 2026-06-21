const BASE = 'http://localhost:10408'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(body || `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface FieldSpec {
  name: string
  type: string
  source: string
  fakerProvider?: string | null
  fakerLocale?: string | null
  pattern?: string | null
  template?: string | null
  enumValues?: string[] | null
  enumWeights?: number[] | null
  rangeMin?: number | null
  rangeMax?: number | null
  constant?: string | null
  nullable: boolean
  nullRate: number
  unique: boolean
  isKey: boolean
  conditionalOn?: string | null
  conditionalValue?: string | null
  correlatedWith?: string | null
  correlationType?: string | null
  referenceEntity?: string | null
  referenceField?: string | null
  maxLength?: number | null
  minLength?: number | null
  children?: FieldSpec[] | null
}

export interface EntitySpec {
  name: string
  fields: FieldSpec[]
}

export interface ApiEndpoint {
  method: string
  path: string
  entityName: string
  headers?: Record<string, string> | null
}

export interface GenerationSpec {
  entities: EntitySpec[]
  mode: string
  apiBaseUrl?: string | null
  apiEndpoints?: ApiEndpoint[] | null
}

export interface SpecRecord {
  id: number
  name: string
  mode: string
  spec: GenerationSpec
  version: number
  createdAt: string
  updatedAt: string
}

export interface SpecVersionRecord {
  id: number
  specId: number
  version: number
  spec: GenerationSpec
  createdAt: string
}

export interface GenerateResponse {
  records: string[]
  profile: string
  count: number
  entityName: string
}

export const mockgenApi = {
  health: (): Promise<{ status: string }> => req('/health'),

  getConfig: (): Promise<Record<string, string>> => req('/config'),
  updateConfig: (data: Record<string, string>): Promise<Record<string, string>> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),

  getSpecs: (): Promise<SpecRecord[]> => req('/specs'),
  getSpec: (id: number): Promise<SpecRecord> => req(`/specs/${id}`),
  updateSpec: (id: number, spec: GenerationSpec): Promise<SpecRecord> =>
    req(`/specs/${id}`, { method: 'PUT', body: JSON.stringify(spec) }),
  deleteSpec: (id: number): Promise<void> =>
    req(`/specs/${id}`, { method: 'DELETE' }),

  getHistory: (id: number): Promise<SpecVersionRecord[]> => req(`/specs/${id}/history`),
  rollback: (id: number, version: number): Promise<SpecRecord> =>
    req(`/specs/${id}/rollback/${version}`, { method: 'POST' }),

  infer: (data: { name: string; mode: string; samples: string[]; schema?: string; schemaType?: string }): Promise<SpecRecord> =>
    req('/infer', { method: 'POST', body: JSON.stringify(data) }),

  generate: (data: { specId: number; count: number; profile: string; seed?: number; entityName?: string }): Promise<GenerateResponse> =>
    req('/generate', { method: 'POST', body: JSON.stringify(data) }),

  getExportUrl: (id: number, type: 'generate' | 'call_api'): string =>
    `${BASE}/specs/${id}/export?type=${type}`,
}
