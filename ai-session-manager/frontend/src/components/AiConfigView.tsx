import { useCallback, useEffect, useState } from 'react'
import type { AiConfigCategory, AiConfigResult } from '../api/sessionsApi'
import { sessionsApi } from '../api/sessionsApi'

export default function AiConfigView() {
  const [config, setConfig] = useState<AiConfigResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<Record<string, string>>({})
  const [loadingFile, setLoadingFile] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await sessionsApi.getAiConfig()
      setConfig(data)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleFile = async (path: string) => {
    if (expandedFile === path) {
      setExpandedFile(null)
      return
    }
    setExpandedFile(path)
    if (!fileContent[path]) {
      setLoadingFile(path)
      try {
        const data = await sessionsApi.getAiConfigFile(path)
        setFileContent(prev => ({ ...prev, [path]: data.content }))
      } catch {
        setFileContent(prev => ({ ...prev, [path]: '(failed to load)' }))
      } finally {
        setLoadingFile(null)
      }
    }
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Loading configuration...
    </div>
  )

  if (error) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
      {error}
    </div>
  )

  if (!config) return null

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>AI Configuration</h2>
          <p style={{ fontSize: 12, color: '#64748b' }}>
            Read-only view of Claude Code & OpenCode configs
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <ScanPathBadge label="Claude" path={config.scanPaths.claudeDir} />
          <ScanPathBadge label="OpenCode" path={config.scanPaths.openCodeDir} />
          <ScanPathBadge label="MCP" path={config.scanPaths.homeMcpJson} />
        </div>

        {config.categories.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No configuration found in scanned paths.
          </div>
        )}

        {config.categories.map(cat => (
          <CategorySection
            key={cat.name}
            category={cat}
            expandedFile={expandedFile}
            fileContent={fileContent}
            loadingFile={loadingFile}
            onToggleFile={toggleFile}
          />
        ))}
      </div>
    </div>
  )
}

function ScanPathBadge({ label, path }: { label: string; path: string }) {
  return (
    <span style={{
      padding: '4px 10px', borderRadius: 6, fontSize: 11,
      background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)',
      color: '#a78bfa', fontFamily: 'monospace',
    }}>
      {label}: {path}
    </span>
  )
}

function SyncIndicator({ sync }: { sync: { claudeCode: boolean; openCode: boolean } }) {
  const both = sync.claudeCode && sync.openCode
  const color = both ? '#22c55e' : (sync.claudeCode || sync.openCode) ? '#94a3b8' : '#475569'
  const label = both ? 'Shared' : sync.claudeCode ? 'Claude Code only' : sync.openCode ? 'OpenCode only' : 'None'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10.5, color, fontWeight: 500,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        boxShadow: both ? `0 0 6px ${color}` : undefined,
      }} />
      {label}
    </span>
  )
}

function ToolBadge({ tool }: { tool: string }) {
  const isCC = tool === 'claude-code'
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: isCC ? 'rgba(139,92,246,0.15)' : 'rgba(34,197,94,0.15)',
      color: isCC ? '#a78bfa' : '#4ade80',
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {isCC ? 'CC' : 'OC'}
    </span>
  )
}

interface CategorySectionProps {
  category: AiConfigCategory
  expandedFile: string | null
  fileContent: Record<string, string>
  loadingFile: string | null
  onToggleFile: (path: string) => void
}

function CategorySection({ category, expandedFile, fileContent, loadingFile, onToggleFile }: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div style={{
      marginBottom: 16, borderRadius: 10,
      background: '#1a1d2e', border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#64748b" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', flex: 1 }}>
          {category.name}
        </span>
        <span style={{ fontSize: 11, color: '#64748b', marginRight: 8 }}>
          {category.items.length}
        </span>
        <SyncIndicator sync={category.sync} />
      </button>

      {!collapsed && (
        <div style={{ padding: '0 8px 8px' }}>
          {category.items.map((item, i) => (
            <div key={`${item.name}-${i}`}>
              <button
                onClick={() => onToggleFile(item.filePath)}
                style={{
                  width: '100%', padding: '8px 10px',
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: expandedFile === item.filePath ? 'rgba(139,92,246,0.08)' : 'transparent',
                  border: 'none', cursor: 'pointer', borderRadius: 6,
                  textAlign: 'left',
                }}
              >
                <ToolBadge tool={item.tool} />
                <span style={{ fontSize: 12.5, color: '#e2e8f0', flex: 1, fontWeight: 500 }}>
                  {item.name}
                </span>
                <span style={{
                  fontSize: 10, color: '#475569', fontFamily: 'monospace',
                  maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {item.source}
                </span>
              </button>

              {expandedFile === item.filePath && (
                <div style={{
                  margin: '0 10px 8px', padding: 12, borderRadius: 6,
                  background: '#0f1219', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 11, fontFamily: 'monospace', color: '#94a3b8',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  maxHeight: 300, overflow: 'auto',
                }}>
                  {loadingFile === item.filePath ? 'Loading...' : (
                    fileContent[item.filePath] || item.content || '(empty)'
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
