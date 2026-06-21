import { useCallback, useEffect, useState } from 'react'
import type { TopicInfo } from './api/kafkaApi'
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

  const loadTopics = useCallback(async () => {
    setLoading(true)
    try {
      const data = await kafkaApi.getTopics()
      setTopics(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to connect')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTopics() }, [loadTopics])

  const handleDeleteTopic = useCallback(async () => {
    if (!selectedTopic) return
    if (!confirm(`Delete topic "${selectedTopic}"? This cannot be undone.`)) return
    try {
      await kafkaApi.deleteTopic(selectedTopic)
      setSelectedTopic(null)
      loadTopics()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
    }
  }, [selectedTopic, loadTopics])

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
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedTopic ? (
          <MessageViewer
            key={selectedTopic}
            topic={selectedTopic}
            onProduce={() => setShowProduce(true)}
            onDeleteTopic={handleDeleteTopic}
          />
        ) : (
          <ClusterOverview />
        )}
      </main>

      {showProduce && selectedTopic && (
        <ProduceModal
          topic={selectedTopic}
          onClose={() => setShowProduce(false)}
          onProduced={loadTopics}
        />
      )}

      {showCreateTopic && (
        <CreateTopicModal
          onClose={() => setShowCreateTopic(false)}
          onCreated={loadTopics}
        />
      )}
    </div>
  )
}
