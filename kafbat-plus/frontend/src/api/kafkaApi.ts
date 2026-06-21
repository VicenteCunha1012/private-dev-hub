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

function clusterQs(clusterId?: number | null, extra?: URLSearchParams): string {
  const params = extra ?? new URLSearchParams()
  if (clusterId != null) params.set('cluster', String(clusterId))
  const qs = params.toString()
  return qs ? '?' + qs : ''
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

export interface ClusterConfig {
  id: number
  name: string
  brokers: string
  isDefault: boolean
}

export const kafkaApi = {
  health: (): Promise<{ status: string }> => req('/health'),

  // Clusters
  getClusters: (): Promise<ClusterConfig[]> => req('/clusters'),
  createCluster: (name: string, brokers: string): Promise<ClusterConfig> =>
    req('/clusters', { method: 'POST', body: JSON.stringify({ name, brokers }) }),
  updateCluster: (id: number, name: string, brokers: string): Promise<ClusterConfig> =>
    req(`/clusters/${id}`, { method: 'PUT', body: JSON.stringify({ name, brokers }) }),
  deleteCluster: (id: number): Promise<void> =>
    req(`/clusters/${id}`, { method: 'DELETE' }),

  // Cluster
  getCluster: (clusterId?: number | null): Promise<ClusterOverview> =>
    req(`/cluster${clusterQs(clusterId)}`),
  getBrokers: (clusterId?: number | null): Promise<BrokerInfo[]> =>
    req(`/brokers${clusterQs(clusterId)}`),

  // Topics
  getTopics: (search?: string, showInternal?: boolean, clusterId?: number | null): Promise<TopicInfo[]> => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (showInternal) params.set('showInternal', 'true')
    return req(`/topics${clusterQs(clusterId, params)}`)
  },

  getTopicDetails: (topic: string, clusterId?: number | null): Promise<TopicDetails> =>
    req(`/topics/${encodeURIComponent(topic)}${clusterQs(clusterId)}`),

  createTopic: (name: string, partitions: number, replicationFactor: number, clusterId?: number | null): Promise<void> =>
    req(`/topics${clusterQs(clusterId)}`, { method: 'POST', body: JSON.stringify({ name, partitions, replicationFactor }) }),

  deleteTopic: (topic: string, clusterId?: number | null): Promise<void> =>
    req(`/topics/${encodeURIComponent(topic)}${clusterQs(clusterId)}`, { method: 'DELETE' }),

  // Messages
  getMessages: (
    topic: string,
    opts?: { limit?: number; search?: string; key?: string; from?: number; to?: number; partition?: number },
    clusterId?: number | null
  ): Promise<KafkaMessage[]> => {
    const params = new URLSearchParams()
    if (opts?.limit) params.set('limit', String(opts.limit))
    if (opts?.search) params.set('search', opts.search)
    if (opts?.key) params.set('key', opts.key)
    if (opts?.from) params.set('from', String(opts.from))
    if (opts?.to) params.set('to', String(opts.to))
    if (opts?.partition !== undefined) params.set('partition', String(opts.partition))
    return req(`/topics/${encodeURIComponent(topic)}/messages${clusterQs(clusterId, params)}`)
  },

  // Produce
  produce: (topic: string, data: { key?: string; value: string; headers?: Record<string, string>; partition?: number }, clusterId?: number | null): Promise<ProduceResult> =>
    req(`/topics/${encodeURIComponent(topic)}/produce${clusterQs(clusterId)}`, { method: 'POST', body: JSON.stringify(data) }),

  // Config
  getConfig: (): Promise<KafbatConfig> => req('/config'),
  updateConfig: (data: { brokers?: string; defaultLimit?: string }): Promise<KafbatConfig> =>
    req('/config', { method: 'POST', body: JSON.stringify(data) }),
}
