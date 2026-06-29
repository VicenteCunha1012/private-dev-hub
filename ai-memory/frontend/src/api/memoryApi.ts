const BASE = 'http://localhost:10417'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

function post<T>(path: string, body: unknown): Promise<T> {
  return req(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function put<T>(path: string, body: unknown): Promise<T> {
  return req(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function del<T>(path: string): Promise<T> {
  return req(path, { method: 'DELETE' })
}

export interface Handoff {
  id: number; project: string; context: string; content: string
  tool?: string; createdAt?: string; updatedAt?: string
}

export interface Decision {
  id: number; title: string; description: string
  reasoning?: string; alternatives?: string; tags?: string
  project?: string; mrLink?: string; ticketLink?: string
  tool?: string; createdAt?: string; updatedAt?: string
}

export const api = {
  getHandoffs: (project?: string) => req<Handoff[]>(`/handoffs${project ? `?project=${encodeURIComponent(project)}` : ''}`),
  getLatestHandoff: (project: string, context = 'default') =>
    req<Handoff>(`/handoffs/latest?project=${encodeURIComponent(project)}&context=${encodeURIComponent(context)}`),
  getHandoffHistory: (project: string, context = 'default', limit = 20) =>
    req<Handoff[]>(`/handoffs/history?project=${encodeURIComponent(project)}&context=${encodeURIComponent(context)}&limit=${limit}`),
  writeHandoff: (data: { project: string; context?: string; content: string; tool?: string }) =>
    post<Handoff>('/handoffs', data),

  getDecisions: (search?: string, tag?: string, project?: string) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tag) params.set('tag', tag)
    if (project) params.set('project', project)
    const qs = params.toString()
    return req<Decision[]>(`/decisions${qs ? `?${qs}` : ''}`)
  },
  getDecision: (id: number) => req<Decision>(`/decisions/${id}`),
  createDecision: (data: Omit<Decision, 'id' | 'createdAt' | 'updatedAt'>) =>
    post<Decision>('/decisions', data),
  updateDecision: (id: number, data: Partial<Decision>) =>
    put<Decision>(`/decisions/${id}`, data),
  deleteDecision: (id: number) => del<{ status: string }>(`/decisions/${id}`),
  getTags: () => req<string[]>('/decisions/tags'),
  getProjects: () => req<string[]>('/decisions/projects'),
}
