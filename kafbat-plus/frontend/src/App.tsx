import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClusterConfig, TopicInfo } from './api/kafkaApi'
import { kafkaApi } from './api/kafkaApi'
import ClusterOverview from './components/ClusterOverview'
import CreateTopicModal from './components/CreateTopicModal'
import MessageViewer from './components/MessageViewer'
import ProduceModal from './components/ProduceModal'
import TopicList from './components/TopicList'

export default function App() {
  const [topics, setTopics] = useState<TopicInfo[]>([])
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProduce, setShowProduce] = useState(false)
  const [showCreateTopic, setShowCreateTopic] = useState(false)
  const [produceInitialValue, setProduceInitialValue] = useState<string | null>(null)
  const [mainDragOver, setMainDragOver] = useState(false)
  const dragCounter = useRef(0)

  // Spotlight deep-link
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'spotlight-navigate' && e.data.action === 'open-topic') {
        setSelectedTopic(e.data.value)
      }
    }
    const onHash = () => {
      const m = window.location.hash.match(/spotlight=open-topic:(.+)/)
      if (m) { setSelectedTopic(decodeURIComponent(m[1])); window.location.hash = '' }
    }
    window.addEventListener('message', onMsg)
    window.addEventListener('hashchange', onHash)
    onHash()
    return () => { window.removeEventListener('message', onMsg); window.removeEventListener('hashchange', onHash) }
  }, [])

  // Cluster state
  const [clusters, setClusters] = useState<ClusterConfig[]>([])
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null)

  const loadClusters = useCallback(async () => {
    try {
      const data = await kafkaApi.getClusters()
      setClusters(data)
      if (selectedClusterId === null && data.length > 0) {
        const def = data.find(c => c.isDefault) ?? data[0]
        setSelectedClusterId(def.id)
      }
    } catch { /* ignore */ }
  }, [selectedClusterId])

  useEffect(() => { loadClusters() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const data = await kafkaApi.getTopics(undefined, undefined, selectedClusterId)
      setTopics(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [selectedClusterId])

  useEffect(() => {
    if (selectedClusterId !== null) {
      loadTopics()
    }
  }, [selectedClusterId, loadTopics])

  const handleClusterChange = useCallback((id: number) => {
    setSelectedClusterId(id)
    setSelectedTopic(null)
  }, [])

  const handleDeleteTopic = useCallback(async () => {
    if (!selectedTopic) return
    if (!confirm(`Delete topic "${selectedTopic}"? This cannot be undone.`)) return
    try {
      await kafkaApi.deleteTopic(selectedTopic, selectedClusterId)
      setSelectedTopic(null)
      loadTopics()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    }
  }, [selectedTopic, selectedClusterId, loadTopics])

  const handleMainDragOver = useCallback((e: React.DragEvent) => {
    if (!selectedTopic) return
    e.preventDefault()
  }, [selectedTopic])

  const handleMainDragEnter = useCallback((e: React.DragEvent) => {
    if (!selectedTopic) return
    e.preventDefault()
    dragCounter.current++
    setMainDragOver(true)
  }, [selectedTopic])

  const handleMainDragLeave = useCallback(() => {
    dragCounter.current--
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setMainDragOver(false)
    }
  }, [])

  const handleMainDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setMainDragOver(false)
    if (!selectedTopic) return
    const file = e.dataTransfer.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      try {
        const parsed = JSON.parse(text)
        setProduceInitialValue(JSON.stringify(parsed, null, 2))
      } catch {
        setProduceInitialValue(text)
      }
      setShowProduce(true)
    }
    reader.readAsText(file)
  }, [selectedTopic])

  const handleProduceClose = useCallback(() => {
    setShowProduce(false)
    setProduceInitialValue(null)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <TopicList
        topics={topics}
        selectedTopic={selectedTopic}
        onSelect={setSelectedTopic}
        loading={loading}
        error={error}
        onRefresh={loadTopics}
        onCreateTopic={() => setShowCreateTopic(true)}
        clusters={clusters}
        selectedClusterId={selectedClusterId}
        onClusterChange={handleClusterChange}
      />

      <main
        onDragOver={handleMainDragOver}
        onDragEnter={handleMainDragEnter}
        onDragLeave={handleMainDragLeave}
        onDrop={handleMainDrop}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          position: 'relative',
          border: mainDragOver ? '2px dashed var(--accent)' : '2px dashed transparent',
          transition: 'border-color 0.15s',
        }}
      >
        {mainDragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(99,102,241,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <span style={{
              fontSize: 14, fontWeight: 600, color: 'var(--accent)',
              background: 'var(--bg-secondary)', padding: '10px 20px',
              borderRadius: 8, border: '1px solid var(--accent)',
            }}>Drop JSON to produce</span>
          </div>
        )}
        {selectedTopic ? (
          <MessageViewer
            key={`${selectedClusterId}-${selectedTopic}`}
            topic={selectedTopic}
            onProduce={() => setShowProduce(true)}
            onDeleteTopic={handleDeleteTopic}
            clusterId={selectedClusterId}
          />
        ) : (
          <ClusterOverview clusterId={selectedClusterId} />
        )}
      </main>

      {showProduce && selectedTopic && (
        <ProduceModal
          topic={selectedTopic}
          onClose={handleProduceClose}
          onProduced={loadTopics}
          initialValue={produceInitialValue ?? undefined}
          clusterId={selectedClusterId}
        />
      )}

      {showCreateTopic && (
        <CreateTopicModal
          onClose={() => setShowCreateTopic(false)}
          onCreated={loadTopics}
          clusterId={selectedClusterId}
        />
      )}
    </div>
  )
}
