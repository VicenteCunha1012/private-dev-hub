const BASE = 'http://localhost:10402'

async function req<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface SessionSummary {
  id: string
  title: string
  project: string
  tool: string
  model: string | null
  lastActivity: number
  messageCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  estimatedCostUsd: number
  version: string | null
}

export interface TurnSummary {
  role: string
  timestamp: number | null
  inputTokens: number
  outputTokens: number
  model: string | null
  preview: string | null
}

export interface SessionDetail extends SessionSummary {
  turns: TurnSummary[]
  mcpTools: string[]
}

export interface ModelSpending {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
}

export interface SpendingReport {
  tool: string
  totalSessions: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  estimatedCostUsd: number
  byModel: Record<string, ModelSpending>
  byProject: Record<string, number>
}

export interface ProjectInfo {
  path: string
  dirName: string
  sessionCount: number
  lastActivity: number
}

export const sessionsApi = {
  health: (): Promise<{ status: string }> => req('/health'),
  getSessions: (tool: string = 'claude-code'): Promise<SessionSummary[]> => req(`/sessions?tool=${tool}`),
  getSessionDetail: (id: string): Promise<SessionDetail> => req(`/sessions/${id}`),
  getSpending: (tool: string = 'claude-code'): Promise<SpendingReport> => req(`/spending?tool=${tool}`),
  getProjects: (): Promise<ProjectInfo[]> => req('/projects'),
  getConfig: (): Promise<{ claudeDir: string }> => req('/config'),
}
