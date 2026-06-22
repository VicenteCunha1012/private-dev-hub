import { useCallback, useEffect, useState } from 'react'
import type { KafkaMessage, TopicDetails } from '../api/kafkaApi'
import { kafkaApi } from '../api/kafkaApi'
import JsonViewer from './JsonViewer'

interface MessageViewerProps {
  topic: string
  onProduce: () => void
  onDeleteTopic: () => void
  clusterId?: number | null
}

export default function MessageViewer({ topic, onProduce, onDeleteTopic, clusterId }: MessageViewerProps) {
  const [messages, setMessages] = useState<KafkaMessage[]>([])
  const [details, setDetails] = useState<TopicDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'messages' | 'partitions' | 'config'>('messages')
  const [expandedMsg, setExpandedMsg] = useState<number | null>(null)

  // Filters
  const [searchVal, setSearchVal] = useState('')
  const [keyFilter, setKeyFilter] = useState('')
  const [partitionFilter, setPartitionFilter] = useState<string>('')
  const [limit, setLimit] = useState(100)
  const [activeSearch, setActiveSearch] = useState('')
  const [activeKey, setActiveKey] = useState('')
  const [activePartition, setActivePartition] = useState<string>('')

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const msgs = await kafkaApi.getMessages(topic, {
        limit,
        search: activeSearch || undefined,
        key: activeKey || undefined,
        partition: activePartition !== '' ? parseInt(activePartition) : undefined,
      }, clusterId)
      setMessages(msgs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch messages')
    } finally {
      setLoading(false)
    }
  }, [topic, limit, activeSearch, activeKey, activePartition, clusterId])

  const fetchDetails = useCallback(async () => {
    try {
      const d = await kafkaApi.getTopicDetails(topic, clusterId)
      setDetails(d)
    } catch { /* ignore */ }
  }, [topic, clusterId])

  useEffect(() => {
    setMessages([])
    setDetails(null)
    setTab('messages')
    setSearchVal('')
    setKeyFilter('')
    setPartitionFilter('')
    setActiveSearch('')
    setActiveKey('')
    setActivePartition('')
    setExpandedMsg(null)
    fetchMessages()
    fetchDetails()
  }, [topic, fetchMessages, fetchDetails])

  const applyFilters = () => {
    setActiveSearch(searchVal)
    setActiveKey(keyFilter)
    setActivePartition(partitionFilter)
  }

  const clearFilters = () => {
    setSearchVal('')
    setKeyFilter('')
    setPartitionFilter('')
    setActiveSearch('')
    setActiveKey('')
    setActivePartition('')
  }

  const hasFilters = activeSearch || activeKey || activePartition

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topic header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--bg-secondary)',
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.3 }}>{topic}</h2>
          {details && (
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <Stat label="Partitions" value={details.partitions.length} />
              <Stat label="Messages" value={details.partitions.reduce((s, p) => s + (p.endOffset - p.beginOffset), 0)} />
              <Stat label="Replication" value={details.partitions[0]?.replicas.length ?? 0} />
            </div>
          )}
        </div>
        <button onClick={onProduce} style={{
          padding: '7px 14px', fontSize: 12, fontWeight: 500,
          background: 'var(--accent)', color: '#fff', borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 5,
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
          Produce
        </button>
        <button onClick={onDeleteTopic} style={{
          padding: '7px 10px', fontSize: 12,
          color: 'var(--danger)', borderRadius: 6,
          border: '1px solid rgba(239,68,68,0.2)',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = '')}
        >
          Delete
        </button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
      }}>
        {(['messages', 'partitions', 'config'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 12.5, fontWeight: 500,
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              textTransform: 'capitalize',
              transition: 'color 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Messages tab */}
      {tab === 'messages' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Filter bar */}
          <div style={{
            padding: '10px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <input
              type="search"
              placeholder="Search value..."
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              style={{ maxWidth: 200, fontSize: 12 }}
            />
            <input
              placeholder="Key filter..."
              value={keyFilter}
              onChange={e => setKeyFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
              style={{ maxWidth: 150, fontSize: 12 }}
            />
            <select
              value={partitionFilter}
              onChange={e => setPartitionFilter(e.target.value)}
              style={{ maxWidth: 120, fontSize: 12 }}
            >
              <option value="">All partitions</option>
              {details?.partitions.map(p => (
                <option key={p.partition} value={p.partition}>Partition {p.partition}</option>
              ))}
            </select>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ maxWidth: 80, fontSize: 12 }}
            >
              {[50, 100, 200, 500].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button onClick={applyFilters} style={{
              padding: '7px 12px', fontSize: 12, fontWeight: 500,
              background: 'var(--accent)', color: '#fff', borderRadius: 6,
            }}>
              Search
            </button>
            {hasFilters && (
              <button onClick={clearFilters} style={{
                padding: '7px 12px', fontSize: 12, color: 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 6,
              }}>
                Clear
              </button>
            )}
            <button onClick={fetchMessages} style={{
              marginLeft: 'auto',
              padding: '6px 8px', color: 'var(--text-muted)', borderRadius: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115.82-5.84L21 8" />
                <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15.82 5.84L3 16" />
              </svg>
            </button>
          </div>

          {/* Messages list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {error && (
              <div style={{
                margin: '8px 20px', padding: '10px 14px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, fontSize: 12, color: 'var(--danger)',
              }}>
                {error}
              </div>
            )}

            {loading && messages.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading messages...
              </div>
            )}

            {!loading && messages.length === 0 && !error && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No messages found
              </div>
            )}

            {messages.map((msg, i) => (
              <MessageRow
                key={`${msg.partition}-${msg.offset}`}
                msg={msg}
                topic={topic}
                clusterId={clusterId}
                expanded={expandedMsg === i}
                onToggle={() => setExpandedMsg(expandedMsg === i ? null : i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Partitions tab */}
      {tab === 'partitions' && details && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Partition', 'Leader', 'Replicas', 'ISR', 'Begin Offset', 'End Offset', 'Messages'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 12px', fontWeight: 600,
                    color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {details.partitions.map(p => (
                <tr key={p.partition} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{p.partition}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 6px', borderRadius: 4, fontSize: 11,
                      background: 'rgba(99,102,241,0.1)', color: 'var(--accent)',
                    }}>Broker {p.leader}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{p.replicas.join(', ')}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      color: p.isr.length === p.replicas.length ? 'var(--success)' : 'var(--warning)',
                    }}>{p.isr.join(', ')}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{p.beginOffset}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{p.endOffset}</td>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{p.endOffset - p.beginOffset}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Config tab */}
      {tab === 'config' && details && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{
                  textAlign: 'left', padding: '8px 12px', fontWeight: 600,
                  color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>Key</th>
                <th style={{
                  textAlign: 'left', padding: '8px 12px', fontWeight: 600,
                  color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(details.configs).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5, color: 'var(--json-key)' }}>{k}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11.5 }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function MessageRow({ msg, topic, clusterId, expanded, onToggle }: {
  msg: KafkaMessage; topic: string; clusterId?: number | null; expanded: boolean; onToggle: () => void
}) {
  const ts = new Date(msg.timestamp)
  const [fullValue, setFullValue] = useState<string | null>(null)
  const [loadingValue, setLoadingValue] = useState(false)

  useEffect(() => {
    if (expanded && fullValue === null && !loadingValue) {
      setLoadingValue(true)
      kafkaApi.getMessage(topic, msg.partition, msg.offset, clusterId)
        .then(full => setFullValue(full.value))
        .catch(() => setFullValue(msg.valuePreview || '(failed to load)'))
        .finally(() => setLoadingValue(false))
    }
  }, [expanded, fullValue, loadingValue, topic, msg.partition, msg.offset, clusterId, msg.valuePreview])

  const preview = msg.valuePreview ?? msg.value?.slice(0, 200)
  const sizeLabel = msg.valueSize > 1024 ? `${(msg.valueSize / 1024).toFixed(0)}KB` : `${msg.valueSize}B`

  return (
    <div style={{
      margin: '0 12px 4px', borderRadius: 8,
      border: '1px solid var(--border)',
      background: expanded ? 'var(--card-hover)' : 'var(--card-bg)',
      transition: 'background 0.1s',
    }}>
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
          transition: 'transform 0.15s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          flexShrink: 0,
        }}>
          <path d="M3.5 2L6.5 5L3.5 8" stroke="var(--text-muted)" strokeWidth="1.3" strokeLinecap="round" />
        </svg>

        <span style={{
          fontSize: 10, fontFamily: 'monospace', color: 'var(--text-dim)',
          padding: '1px 5px', background: 'rgba(255,255,255,0.04)', borderRadius: 3,
        }}>
          P{msg.partition}
        </span>
        <span style={{
          fontSize: 10, fontFamily: 'monospace', color: 'var(--text-dim)',
          padding: '1px 5px', background: 'rgba(255,255,255,0.04)', borderRadius: 3,
        }}>
          #{msg.offset}
        </span>

        {msg.key && (
          <span style={{
            fontSize: 11, fontFamily: 'monospace', color: 'var(--info)',
            maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {msg.key}
          </span>
        )}

        <span style={{
          flex: 1, fontSize: 11.5, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'monospace',
        }}>
          {preview?.slice(0, 120)}
        </span>

        <span style={{
          fontSize: 9, color: 'var(--text-dim)', padding: '1px 5px',
          background: 'rgba(255,255,255,0.04)', borderRadius: 3, flexShrink: 0,
        }}>
          {sizeLabel}
        </span>

        <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {ts.toLocaleTimeString()} {ts.toLocaleDateString()}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, marginBottom: 10 }}>
            <Detail label="Partition" value={String(msg.partition)} />
            <Detail label="Offset" value={String(msg.offset)} />
            <Detail label="Key" value={msg.key || '—'} />
            <Detail label="Timestamp" value={ts.toISOString()} />
            <Detail label="Size" value={sizeLabel} />
          </div>
          {Object.keys(msg.headers).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Headers</span>
              <div style={{
                marginTop: 4, padding: '6px 10px',
                background: 'rgba(0,0,0,0.2)', borderRadius: 6, fontSize: 11,
              }}>
                {Object.entries(msg.headers).map(([k, v]) => (
                  <div key={k}><span style={{ color: 'var(--json-key)' }}>{k}</span>: {v}</div>
                ))}
              </div>
            </div>
          )}
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Value</span>
          <div style={{
            marginTop: 4, padding: '10px 12px',
            background: 'rgba(0,0,0,0.2)', borderRadius: 6,
          }}>
            {loadingValue ? (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Loading value...</span>
            ) : (
              <JsonViewer data={fullValue} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{value.toLocaleString()}</span>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 11.5, fontFamily: 'monospace', marginTop: 2 }}>{value}</div>
    </div>
  )
}
