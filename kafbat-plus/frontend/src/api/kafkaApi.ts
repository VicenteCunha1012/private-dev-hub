const BASE = 'http://localhost:10401'

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

export interface BrokerInfo {
  id: number
  host: string
  port: number
  isController: boolean
}

export interface TopicInfo {
  name: string
  partitions: number
  replicationFactor: number
  messageCount: number
}

export interface PartitionInfo {
  partition: number
  leader: number
  replicas: number[]
  isr: number[]
  beginOffset: number
  endOffset: number
}

export interface TopicDetails {
  name: string
  partitions: PartitionInfo[]
  configs: Record<string, string>
}

export interface KafkaMessage {
  partition: number
  offset: number
  timestamp: number
  key: string | null
  value: string | null
  headers: Record<string, string>
}

export interface ProduceResult {
  topic: string
  partition: number
  offset: number
  timestamp: number
}

export interface ClusterOverview {
  brokers: BrokerInfo[]
  topicCount: number
  totalPartitions: number
  controllerId: number
}

export interface KafbatConfig {
  brokers: string
  default_limit: string
}

export const kafkaApi = {
  health: (): Promise<{ status: string }> => req('/health'),

  // Cluster
  getCluster: (): Promise<ClusterOverview> => req('/cluster'),
  getBrokers: (): Promise<BrokerInfo[]> => req('/brokers'),

  // Topics
  getTopics: (search?: string, showInternal?: boolean): Promise<TopicInfo[]> => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (showInternal) params.set('showInternal', 'true')
    const qs = params.toString()
    return req(`/topics${qs ? '?' + qs : ''}`)
  },

  getTopicDetails: (topic: string): Promise<TopicDetails> =>
    req(`/topics/${encodeURIComponent(topic)}`),

  createTopic: (name: string, partitions: number, replicationFactor: number): Promise<void> =>
    req('/topics', { method: 'POST', body: JSON.stringify({ name, partitions, replicationFactor }) }),

  deleteTopic: (topic: string): Promise<void> =>
    req(`/topics/${encodeURIComponent(topic)}`, { method: 'DELETE' }),

  // Messages
  getMessages: (
    topic: string,
    opts?: { limit?: number; search?: string; key?: string; from?: number; to?: number; partition?: number }
  ): Promise<KafkaMessage[]> => {
    const params = new URLSearchParams()
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.search) params.set('search', opts.search)
    if (opts?.key) params.set('key', opts.key)
    if (opts?.from) params.set('from', String(opts.from))
    if (opts?.to) params.set('to', String(opts.to))
    if (opts?.partition !== undefined) params.set('partition', String(opts.partition))
    const qs = params.toString()
    return req(`/topics/${encodeURIComponent(topic)}/messages${qs ? '?' + qs : ''}`)
  },

  // Produce
  produce: (topic: string, data: { key?: string; value: string; headers?: Record<string, string>; partition?: number }): Promise<ProduceResult> =>
    req(`/topics/${encodeURIComponent(topic)}/produce`, { method: 'POST', body: JSON.stringify(data) }),

  // Config
  getConfig: (): Promise<KafbatConfig> => req('/config'),
  updateConfig: (data: { brokers?: string; defaultLimit?: string }): Promise<KafbatConfig> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),
}
