import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, Panel,
  useNodesState, useEdgesState, addEdge,
  Handle, Position, MarkerType, ReactFlowProvider, useReactFlow,
  useUpdateNodeInternals,
  type Node, type Edge, type Connection, type NodeTypes, type OnConnect,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { vaultApi } from '../api/vaultApi'
import { parseVariables, substituteVariables } from '../lib/variables'

// ── Data models ──────────────────────────────────────────────────────────────

interface ConstantOutput {
  id: string
  name: string
  value: string
}

interface ConstantNodeData {
  outputs: ConstantOutput[]
  [key: string]: unknown
}

interface CommandNodeData {
  command: string
  workdir?: string
  timeoutSeconds?: number
  _status?: 'idle' | 'running' | 'done' | 'error'
  _stdout?: string
  _stderr?: string
  _exitCode?: number
  [key: string]: unknown
}

interface StartNodeData {
  _onRun?: () => void
  _onStop?: () => void
  _running?: boolean
  [key: string]: unknown
}

interface DisplayNodeData {
  filterRegex?: string
  _text?: string
  [key: string]: unknown
}

interface SubflowNodeData {
  flowId: number
  flowName: string
  color?: string
  inputs: string[]
  _status?: 'idle' | 'running' | 'done' | 'error'
  _stdout?: string
  [key: string]: unknown
}

type FlowNode = Node<ConstantNodeData | CommandNodeData | StartNodeData | DisplayNodeData | SubflowNodeData>

// ── Styles ───────────────────────────────────────────────────────────────────

const nodeBox: React.CSSProperties = {
  background: '#171425', border: '1px solid #2a2440', borderRadius: 8,
  padding: 12, minWidth: 200, fontFamily: 'var(--mono, monospace)', fontSize: 12,
  color: '#e8e3f5',
}
const labelStyle: React.CSSProperties = { fontSize: 10, color: '#7a7395', marginBottom: 2 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '4px 6px', fontSize: 11, background: '#0e0c15',
  border: '1px solid #2a2440', borderRadius: 4, color: '#e8e3f5',
  fontFamily: 'var(--mono, monospace)', outline: 'none',
}
const NODRAG = 'nodrag nowheel'
const smallBtnStyle: React.CSSProperties = {
  background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: 'none',
  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
}

// ── Start Node ───────────────────────────────────────────────────────────────

function StartNode({ data }: { data: StartNodeData }) {
  const isRunning = !!data._running
  return (
    <div
      onClick={() => isRunning ? data._onStop?.() : data._onRun?.()}
      style={{
        ...nodeBox, minWidth: 100, textAlign: 'center', cursor: 'pointer',
        borderColor: isRunning ? '#f87171' : '#fbbf24',
        background: isRunning ? 'rgba(248,113,113,0.08)' : '#171425',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: isRunning ? '#f87171' : '#fbbf24',
      }}>
        {isRunning ? '■ Stop' : '▶ Start'}
      </div>
      <Handle type="source" position={Position.Right} id="flow-out" className="flow-handle" />
    </div>
  )
}

// ── Display Node ─────────────────────────────────────────────────────────────

function DisplayNode({ id, data }: { id: string; data: DisplayNodeData }) {
  const { setNodes } = useReactFlow()

  const updateFilter = (regex: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, filterRegex: regex } } : n))
  }

  let displayText = data._text ?? ''
  if (displayText && data.filterRegex) {
    try {
      const re = new RegExp(data.filterRegex)
      displayText = displayText.split('\n').filter(line => !re.test(line)).join('\n')
    } catch { /* invalid regex, show unfiltered */ }
  }

  return (
    <div style={{ ...nodeBox, minWidth: 260, borderColor: '#38bdf8' }}>
      <Handle type="target" position={Position.Left} id="in-text" className="data-handle" />

      <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Display
      </div>

      <div style={labelStyle}>Filter regex (lines to hide)</div>
      <input value={data.filterRegex ?? ''} onChange={e => updateFilter(e.target.value)}
        className={NODRAG} style={inputStyle} placeholder="e.g. ^\\s*$" />

      <div style={{ marginTop: 8, padding: '6px 8px', background: '#0e0c15', borderRadius: 4, fontSize: 11, color: '#e8e3f5', fontFamily: 'var(--mono, monospace)', minHeight: 40, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {displayText || <span style={{ color: '#4a4560', fontStyle: 'italic' }}>No input received</span>}
      </div>
    </div>
  )
}

// ── Constant Node ────────────────────────────────────────────────────────────

function ConstantNode({ id, data }: { id: string; data: ConstantNodeData }) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const prevOutputCount = useRef(data.outputs.length)

  useEffect(() => {
    if (data.outputs.length !== prevOutputCount.current) {
      prevOutputCount.current = data.outputs.length
      updateNodeInternals(id)
    }
  }, [data.outputs.length, id, updateNodeInternals])

  const updateOutput = (outputId: string, field: 'name' | 'value', val: string) => {
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n, data: {
        ...n.data,
        outputs: (n.data as ConstantNodeData).outputs.map(o =>
          o.id === outputId ? { ...o, [field]: val } : o
        )
      }
    } : n))
  }

  const addOutput = () => {
    const newId = crypto.randomUUID()
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n, data: {
        ...n.data,
        outputs: [...(n.data as ConstantNodeData).outputs, { id: newId, name: 'output', value: '' }]
      }
    } : n))
  }

  const removeOutput = (outputId: string) => {
    setNodes(nds => nds.map(n => n.id === id ? {
      ...n, data: {
        ...n.data,
        outputs: (n.data as ConstantNodeData).outputs.filter(o => o.id !== outputId)
      }
    } : n))
  }

  return (
    <div style={nodeBox}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Constant
      </div>
      {data.outputs.map((out) => (
        <div key={out.id} style={{ marginBottom: 6, position: 'relative', paddingRight: 16 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input value={out.name} onChange={e => updateOutput(out.id, 'name', e.target.value)}
              className={NODRAG} style={{ ...inputStyle, width: '35%' }} placeholder="name" />
            <input value={out.value} onChange={e => updateOutput(out.id, 'value', e.target.value)}
              className={NODRAG} style={{ ...inputStyle, flex: 1 }} placeholder="value" />
            {data.outputs.length > 1 && (
              <button onClick={() => removeOutput(out.id)} style={{ ...smallBtnStyle, color: '#f87171', background: 'rgba(248,113,113,0.1)', padding: '0 4px' }}>x</button>
            )}
          </div>
          <Handle type="source" position={Position.Right} id={out.id} className="data-handle-green" />
        </div>
      ))}
      <button onClick={addOutput} style={smallBtnStyle}>+ Output</button>
    </div>
  )
}

// ── Command Node ─────────────────────────────────────────────────────────────

function CommandNode({ id, data }: { id: string; data: CommandNodeData }) {
  const { setNodes } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const vars = parseVariables(data.command || '')
  const prevVarCount = useRef(vars.length)

  useEffect(() => {
    if (vars.length !== prevVarCount.current) {
      prevVarCount.current = vars.length
      updateNodeInternals(id)
    }
  }, [vars.length, id, updateNodeInternals])

  const updateCommand = (cmd: string) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, command: cmd } } : n))
  }

  const statusColor = data._status === 'running' ? '#fbbf24' : data._status === 'done' ? '#4ade80' : data._status === 'error' ? '#f87171' : '#7a7395'

  const allLeftHandles = ['workdir', ...vars.map(v => v.name)]

  return (
    <div style={{ ...nodeBox, minWidth: 260 }}>
      <Handle type="target" position={Position.Top} id="flow-in" className="flow-handle" />
      <Handle type="source" position={Position.Bottom} id="flow-out" className="flow-handle" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Command
        </span>
        {data._status && data._status !== 'idle' && (
          <span style={{ fontSize: 9, color: statusColor, fontWeight: 600 }}>
            {data._status === 'running' ? 'Running...' : data._status === 'done' ? `Exit ${data._exitCode}` : 'Error'}
          </span>
        )}
      </div>

      <div style={labelStyle}>Command</div>
      <textarea value={data.command || ''} onChange={e => updateCommand(e.target.value)}
        className={NODRAG} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="echo {msg}" />

      {allLeftHandles.map((name, i) => {
        const isVar = name !== 'workdir'
        return (
          <div key={name} style={{ marginTop: i === 0 ? 10 : 4, position: 'relative', paddingLeft: 16, fontSize: 11, color: isVar ? '#f472b6' : '#7a7395' }}>
            {isVar ? `{${name}}` : 'workdir'}
            <Handle type="target" position={Position.Left} id={isVar ? `in-${name}` : 'in-workdir'} className="data-handle" />
          </div>
        )
      })}

      <div style={{ marginTop: 10, position: 'relative', paddingRight: 16, fontSize: 11, color: '#7a7395', textAlign: 'right' }}>
        stdout
        <Handle type="source" position={Position.Right} id="out-stdout" className="data-handle" />
      </div>

      {data._stdout != null && (
        <div style={{ marginTop: 6, padding: '4px 6px', background: '#0e0c15', borderRadius: 4, fontSize: 10, color: '#7a7395', maxHeight: 60, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {data._stdout.slice(0, 500)}
        </div>
      )}
    </div>
  )
}

// ── Subflow Node ─────────────────────────────────────────────────────────

function SubflowNode({ data }: { id: string; data: SubflowNodeData }) {
  const color = data.color || '#a78bfa'
  const statusColor = data._status === 'running' ? '#fbbf24' : data._status === 'done' ? '#4ade80' : data._status === 'error' ? '#f87171' : '#7a7395'

  return (
    <div style={{ ...nodeBox, minWidth: 220, borderColor: color, borderWidth: 2 }}>
      <Handle type="target" position={Position.Top} id="flow-in" className="flow-handle" />
      <Handle type="source" position={Position.Bottom} id="flow-out" className="flow-handle" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ⚡ {data.flowName}
        </span>
        {data._status && data._status !== 'idle' && (
          <span style={{ fontSize: 9, color: statusColor, fontWeight: 600 }}>
            {data._status === 'running' ? 'Running...' : data._status === 'done' ? 'Done' : 'Error'}
          </span>
        )}
      </div>

      {data.inputs.map(name => (
        <div key={name} style={{ marginTop: 4, position: 'relative', paddingLeft: 16, fontSize: 11, color: '#7a7395' }}>
          {name}
          <Handle type="target" position={Position.Left} id={`in-${name}`} className="data-handle" />
        </div>
      ))}

      <div style={{ marginTop: 8, position: 'relative', paddingRight: 16, fontSize: 11, color: '#7a7395', textAlign: 'right' }}>
        stdout
        <Handle type="source" position={Position.Right} id="out-stdout" className="data-handle" />
      </div>

      {data._stdout != null && (
        <div style={{ marginTop: 6, padding: '4px 6px', background: '#0e0c15', borderRadius: 4, fontSize: 10, color: '#7a7395', maxHeight: 60, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {data._stdout.slice(0, 500)}
        </div>
      )}
    </div>
  )
}

// Helper: analyze a flow's graph to find exposed inputs
function analyzeFlowInputs(graphJson: string): string[] {
  try {
    const graph = JSON.parse(graphJson)
    const nodes: Array<{ id: string; type: string; data: Record<string, unknown> }> = graph.nodes ?? []
    const edges: Array<{ target: string; targetHandle: string }> = graph.edges ?? []

    const connectedTargets = new Set(edges.map(e => `${e.target}:${e.targetHandle}`))
    const inputs: string[] = []

    for (const node of nodes) {
      if (node.type === 'command') {
        const cmd = (node.data.command as string) || ''
        const vars = parseVariables(cmd)
        for (const v of vars) {
          if (!connectedTargets.has(`${node.id}:in-${v.name}`)) inputs.push(v.name)
        }
        if (!connectedTargets.has(`${node.id}:in-workdir`)) inputs.push('workdir')
      }
    }

    return [...new Set(inputs)]
  } catch { return [] }
}

// ── Edge helpers ─────────────────────────────────────────────────────────────

function isFlowHandle(handleId: string | null | undefined): boolean {
  return handleId === 'flow-in' || handleId === 'flow-out'
}

function isValidConnection(connection: Edge | Connection): boolean {
  const srcFlow = isFlowHandle(connection.sourceHandle ?? null)
  const tgtFlow = isFlowHandle(connection.targetHandle ?? null)
  if (srcFlow !== tgtFlow) return false
  if (connection.source === connection.target) return false
  return true
}

function makeEdge(connection: Connection): Partial<Edge> {
  const isFlow = isFlowHandle(connection.sourceHandle)
  if (isFlow) {
    return {
      type: 'default',
      style: { stroke: '#fbbf24', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#fbbf24' },
      data: { kind: 'flow' },
    }
  }
  return {
    type: 'default',
    style: { stroke: '#7a7395', strokeWidth: 1.5, strokeDasharray: '5 3' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#7a7395' },
    data: { kind: 'data' },
  }
}

// ── Execution engine ─────────────────────────────────────────────────────────

async function executeFlow(
  nodes: FlowNode[],
  edges: Edge[],
  setNodes: (updater: (nds: FlowNode[]) => FlowNode[]) => void,
  setError: (msg: string | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  setError(null)
  const flowEdges = edges.filter(e => isFlowHandle(e.sourceHandle))

  const startNode = nodes.find(n => n.type === 'start')
  if (!startNode) {
    setError('No Start node found. Add a Start node to define execution order.')
    return
  }

  const adj = new Map<string, string>()
  for (const e of flowEdges) {
    adj.set(e.source, e.target)
  }

  const order: string[] = []
  const visited = new Set<string>()
  let current: string | undefined = startNode.id
  while (current) {
    if (visited.has(current)) {
      setError('Cycle detected in flow edges. Cannot execute.')
      return
    }
    visited.add(current)
    const curNode = nodes.find(n => n.id === current)
    if (curNode?.type === 'command' || curNode?.type === 'subflow') {
      order.push(current)
    }
    current = adj.get(current)
  }

  if (order.length === 0) {
    setError('No command nodes connected to the Start node.')
    return
  }

  const dataEdges = edges.filter(e => !isFlowHandle(e.sourceHandle))
  const outputMap = new Map<string, string>()

  const updateNode = (nodeId: string, patch: Record<string, unknown>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
  }

  const resolveSource = (sourceId: string, sourceHandle: string | null | undefined): string => {
    const srcNode = nodes.find(n => n.id === sourceId) as FlowNode | undefined
    if (!srcNode) return ''
    if (srcNode.type === 'constant') {
      const d = srcNode.data as ConstantNodeData
      const out = d.outputs.find(o => o.id === sourceHandle)
      return out?.value ?? ''
    }
    if (srcNode.type === 'command' && sourceHandle === 'out-stdout') {
      return outputMap.get(sourceId) ?? ''
    }
    return ''
  }

  // Reset command + subflow nodes
  setNodes(nds => nds.map(n => (n.type === 'command' || n.type === 'subflow') ? { ...n, data: { ...n.data, _status: 'idle', _stdout: undefined, _stderr: undefined, _exitCode: undefined } } : n))
  await new Promise(r => setTimeout(r, 50))

  for (const nodeId of order) {
    const node = nodes.find(n => n.id === nodeId) as FlowNode | undefined
    if (!node) continue

    // Handle subflow nodes
    if (node.type === 'subflow') {
      const sfData = node.data as SubflowNodeData
      updateNode(nodeId, { _status: 'running' })
      await new Promise(r => setTimeout(r, 50))

      try {
        const flow = await vaultApi.getFlow(sfData.flowId)
        const innerGraph = JSON.parse(flow.graphJson)
        const innerNodes: FlowNode[] = innerGraph.nodes ?? []
        const innerEdges: Edge[] = innerGraph.edges ?? []

        // Inject external inputs as constants into the inner graph
        for (const inputName of sfData.inputs) {
          const extEdge = dataEdges.find(e => e.target === nodeId && e.targetHandle === `in-${inputName}`)
          if (extEdge) {
            const val = resolveSource(extEdge.source, extEdge.sourceHandle)
            // Find command nodes with unconnected in-{inputName} and create a constant for them
            for (const iNode of innerNodes) {
              if (iNode.type !== 'command') continue
              const iVars = parseVariables((iNode.data as CommandNodeData).command || '')
              if (iVars.some(v => v.name === inputName)) {
                const constId = `injected-${inputName}-${iNode.id}`
                const handleId = `out-${inputName}`
                innerNodes.push({ id: constId, type: 'constant', position: { x: 0, y: 0 }, data: { outputs: [{ id: handleId, name: inputName, value: val }] } })
                innerEdges.push({ id: `edge-${constId}`, source: constId, sourceHandle: handleId, target: iNode.id, targetHandle: `in-${inputName}` } as Edge)
              }
            }
          }
        }

        // Execute inner flow
        let innerStdout = ''
        const innerSetNodes = (updater: (nds: FlowNode[]) => FlowNode[]) => {
          const updated = updater(innerNodes)
          const lastCmd = updated.filter(n => n.type === 'command').pop()
          if (lastCmd) {
            const s = (lastCmd.data as CommandNodeData)._stdout
            if (s) innerStdout = s
          }
        }
        await executeFlow(innerNodes, innerEdges, innerSetNodes, () => {}, signal)

        outputMap.set(nodeId, innerStdout)
        updateNode(nodeId, { _status: 'done', _stdout: innerStdout })
      } catch (e) {
        updateNode(nodeId, { _status: 'error', _stdout: e instanceof Error ? e.message : 'Subflow failed' })
        break
      }
      continue
    }

    if (node.type !== 'command') continue
    const cmdData = node.data as CommandNodeData

    updateNode(nodeId, { _status: 'running' })
    await new Promise(r => setTimeout(r, 50))

    // Resolve workdir
    let workdir = cmdData.workdir || '/home/cunvic'
    const wdEdge = dataEdges.find(e => e.target === nodeId && e.targetHandle === 'in-workdir')
    if (wdEdge) workdir = resolveSource(wdEdge.source, wdEdge.sourceHandle) || workdir

    // Resolve variables
    const vars = parseVariables(cmdData.command || '')
    const values: Record<string, string> = {}
    for (const v of vars) {
      const edge = dataEdges.find(e => e.target === nodeId && e.targetHandle === `in-${v.name}`)
      if (edge) values[v.name] = resolveSource(edge.source, edge.sourceHandle)
      else values[v.name] = ''
    }

    const finalCmd = substituteVariables(cmdData.command || '', values)
    const timeout = cmdData.timeoutSeconds ?? 30

    // Find display nodes connected to this command's stdout
    const connectedDisplays = dataEdges
      .filter(e => e.source === nodeId && e.sourceHandle === 'out-stdout')
      .map(e => e.target)

    const updateDisplays = (text: string) => {
      for (const did of connectedDisplays) {
        updateNode(did, { _text: text })
      }
    }

    if (signal?.aborted) break

    try {
      const sseUrl = `http://localhost:10600/exec/stream?command=${encodeURIComponent(finalCmd)}&workdir=${encodeURIComponent(workdir)}&timeout=${timeout}`
      const result = await new Promise<{ exitCode: number; stdout: string }>((resolve, reject) => {
        const evtSource = new EventSource(sseUrl)
        let stdout = ''
        let exitCode = 0

        if (signal) {
          signal.addEventListener('abort', () => {
            evtSource.close()
            reject(new Error('Stopped'))
          }, { once: true })
        }

        evtSource.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'stdout') {
              stdout += (stdout ? '\n' : '') + msg.line
              updateNode(nodeId, { _stdout: stdout })
              updateDisplays(stdout)
            } else if (msg.type === 'done') {
              exitCode = msg.exitCode
              evtSource.close()
              resolve({ exitCode, stdout })
            } else if (msg.type === 'error') {
              evtSource.close()
              reject(new Error(msg.message))
            }
          } catch { /* ignore parse errors */ }
        }

        evtSource.onerror = () => {
          evtSource.close()
          if (stdout) resolve({ exitCode: 0, stdout })
          else reject(new Error('SSE connection failed'))
        }
      })

      outputMap.set(nodeId, result.stdout)
      updateNode(nodeId, {
        _status: result.exitCode === 0 ? 'done' : 'error',
        _stdout: result.stdout,
        _exitCode: result.exitCode,
      })
      updateDisplays(result.stdout)
      if (result.exitCode !== 0) break
    } catch (e) {
      updateNode(nodeId, { _status: 'error', _stdout: e instanceof Error ? e.message : 'Failed to reach ttyd-manager' })
      break
    }
  }

  // Resolve Display nodes connected to constants (no execution needed)
  const displayNodes = nodes.filter(n => n.type === 'display')
  for (const dn of displayNodes) {
    const textEdge = dataEdges.find(e => e.target === dn.id && e.targetHandle === 'in-text')
    if (textEdge && nodes.find(n => n.id === textEdge.source)?.type === 'constant') {
      const text = resolveSource(textEdge.source, textEdge.sourceHandle)
      updateNode(dn.id, { _text: text })
    }
  }
}

// ── Strip runtime data before saving ─────────────────────────────────────────

function stripRuntime(nodes: FlowNode[]): FlowNode[] {
  return nodes.map(n => {
    if (n.type === 'command') {
      const { _status, _stdout, _stderr, _exitCode, ...rest } = n.data as CommandNodeData & Record<string, unknown>
      return { ...n, data: rest }
    }
    if (n.type === 'display') {
      const { _text, ...rest } = n.data as DisplayNodeData & Record<string, unknown>
      return { ...n, data: rest }
    }
    if (n.type === 'start') {
      const { _onRun, _onStop, _running, ...rest } = n.data as StartNodeData & Record<string, unknown>
      return { ...n, data: rest }
    }
    if (n.type === 'subflow') {
      const { _status, _stdout, ...rest } = n.data as SubflowNodeData & Record<string, unknown>
      return { ...n, data: rest }
    }
    return n
  })
}

// ── Inner editor (needs ReactFlowProvider parent) ────────────────────────────

interface FlowSummary { id: number; name: string; graphJson: string }

function FlowEditorInner({ flowId, initialCommand, allFlows, onNavigateFlow }: { flowId: number; initialCommand?: { title: string; command: string }; allFlows: FlowSummary[]; onNavigateFlow?: (id: number) => void }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [running, setRunning] = useState(false)
  const [flowError, setFlowError] = useState<string | null>(null)
  const loadedRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const flowIdRef = useRef(flowId)
  const { screenToFlowPosition } = useReactFlow()

  // Load flow
  useEffect(() => {
    flowIdRef.current = flowId
    loadedRef.current = false
    vaultApi.getFlow(flowId).then(flow => {
      try {
        const graph = JSON.parse(flow.graphJson)
        let loadedNodes: FlowNode[] = graph.nodes ?? []
        const loadedEdges: Edge[] = graph.edges ?? []

        // Ensure a Start node exists
        if (!loadedNodes.find(n => n.type === 'start')) {
          loadedNodes = [{ id: 'start-' + crypto.randomUUID(), type: 'start', position: { x: 100, y: 50 }, data: {} }, ...loadedNodes]
        }

        setNodes(loadedNodes)
        setEdges(loadedEdges)
      } catch {
        setNodes([{ id: 'start-' + crypto.randomUUID(), type: 'start', position: { x: 100, y: 50 }, data: {} }])
        setEdges([])
      }
      setTimeout(() => { loadedRef.current = true }, 200)
    }).catch(() => {
      setNodes([{ id: 'start-' + crypto.randomUUID(), type: 'start', position: { x: 100, y: 50 }, data: {} }])
      setEdges([])
      loadedRef.current = true
    })
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [flowId, setNodes, setEdges])

  // Add initial command node if provided
  useEffect(() => {
    if (!initialCommand || !loadedRef.current) return
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      type: 'command',
      position: screenToFlowPosition({ x: 400, y: 250 }),
      data: { command: initialCommand.command },
    }
    setNodes(nds => [...nds, newNode])
  }, [initialCommand, setNodes, screenToFlowPosition])

  // Autosave (debounced)
  useEffect(() => {
    if (!loadedRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const graphJson = JSON.stringify({ nodes: stripRuntime(nodes), edges })
      vaultApi.updateFlow(flowIdRef.current, { graphJson }).catch(() => {})
    }, 800)
  }, [nodes, edges])

  const updateNodeInternals = useUpdateNodeInternals()
  const onConnect: OnConnect = useCallback((connection) => {
    const edgeProps = makeEdge(connection)
    setEdges(eds => addEdge({ ...connection, ...edgeProps }, eds))
    setTimeout(() => {
      if (connection.source) updateNodeInternals(connection.source)
      if (connection.target) updateNodeInternals(connection.target)
    }, 50)
  }, [setEdges, updateNodeInternals])

  const addNode = useCallback((type: string, extra?: Record<string, unknown>) => {
    const pos = screenToFlowPosition({ x: 350, y: 200 })
    const dataMap: Record<string, Record<string, unknown>> = {
      constant: { outputs: [{ id: crypto.randomUUID(), name: 'value', value: '' }] },
      command: { command: '' },
      display: { filterRegex: '' },
    }
    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      type,
      position: pos,
      data: extra || dataMap[type] || {},
    }
    setNodes(nds => [...nds, newNode])
  }, [setNodes, screenToFlowPosition])

  const abortRef = useRef<AbortController | null>(null)

  const handleRun = useCallback(async () => {
    if (running) return
    const ac = new AbortController()
    abortRef.current = ac
    setRunning(true)
    setFlowError(null)
    try { await executeFlow(nodes, edges, setNodes as (updater: (nds: FlowNode[]) => FlowNode[]) => void, setFlowError, ac.signal) }
    finally { setRunning(false); abortRef.current = null }
  }, [nodes, edges, setNodes, running])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleRunRef = useRef(handleRun)
  handleRunRef.current = handleRun

  const handleStopRef = useRef(handleStop)
  handleStopRef.current = handleStop

  // Inject _onRun/_onStop/_running into start nodes
  useEffect(() => {
    setNodes(nds => nds.map(n => n.type === 'start' ? {
      ...n, data: { ...n.data, _onRun: () => handleRunRef.current(), _onStop: () => handleStopRef.current(), _running: running }
    } : n))
  }, [setNodes, running])

  const nodeTypes: NodeTypes = useMemo(() => ({
    start: StartNode as NodeTypes['start'],
    constant: ConstantNode as NodeTypes['constant'],
    command: CommandNode as NodeTypes['command'],
    display: DisplayNode as NodeTypes['display'],
    subflow: SubflowNode as NodeTypes['subflow'],
  }), [])

  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onEdgeClick={(_event, edge) => setEdges(eds => eds.filter(e => e.id !== edge.id))}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0a0812' }}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background color="#1e1a2e" gap={20} />
        <Controls showInteractive={false} />

        <Panel position="top-left">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#7a7395', textTransform: 'uppercase', letterSpacing: 1, padding: '2px 4px' }}>Built-in</div>
            <button onClick={() => addNode('constant')} style={paletteBtnStyle}>
              <span style={{ color: '#4ade80' }}>■</span> Constant
            </button>
            <button onClick={() => addNode('command')} style={paletteBtnStyle}>
              <span style={{ color: '#ec4899' }}>■</span> Command
            </button>
            <button onClick={() => addNode('display')} style={paletteBtnStyle}>
              <span style={{ color: '#38bdf8' }}>■</span> Display
            </button>
            {allFlows.filter(f => f.id !== flowId).length > 0 && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7a7395', textTransform: 'uppercase', letterSpacing: 1, padding: '2px 4px' }}>Flows</div>
                {allFlows.filter(f => f.id !== flowId).map(f => {
                  const inputs = analyzeFlowInputs(f.graphJson)
                  return (
                    <button key={f.id} onClick={() => addNode('subflow', {
                      flowId: f.id, flowName: f.name, inputs, color: '#a78bfa',
                    })} style={paletteBtnStyle} onDoubleClick={() => onNavigateFlow?.(f.id)}>
                      <span style={{ color: '#a78bfa' }}>⚡</span> {f.name}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </Panel>

        <Panel position="top-right">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <button onClick={running ? handleStop : handleRun} style={{
              ...paletteBtnStyle,
              background: running ? 'rgba(248,113,113,0.15)' : 'rgba(74,222,128,0.15)',
              color: running ? '#f87171' : '#4ade80', fontWeight: 700,
            }}>
              {running ? '■ Stop' : '▶ Run Flow'}
            </button>
            {flowError && (
              <div style={{
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#f87171',
                display: 'flex', alignItems: 'center', gap: 6, maxWidth: 280,
              }}>
                <span>⚠</span>
                <span>{flowError}</span>
                <button onClick={() => setFlowError(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13, padding: 0, marginLeft: 4 }}>×</button>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

const paletteBtnStyle: React.CSSProperties = {
  background: '#171425', border: '1px solid #2a2440', borderRadius: 6,
  padding: '6px 12px', fontSize: 12, color: '#e8e3f5', cursor: 'pointer',
  fontFamily: 'var(--mono, monospace)', display: 'flex', alignItems: 'center', gap: 6,
}

// ── Exported wrapper ─────────────────────────────────────────────────────────

export default function FlowEditor({ flowId, initialCommand, allFlows, onNavigateFlow }: {
  flowId: number; initialCommand?: { title: string; command: string };
  allFlows?: Array<{ id: number; name: string; graphJson: string }>;
  onNavigateFlow?: (id: number) => void;
}) {
  return (
    <ReactFlowProvider>
      <FlowEditorInner flowId={flowId} initialCommand={initialCommand} allFlows={allFlows ?? []} onNavigateFlow={onNavigateFlow} />
    </ReactFlowProvider>
  )
}
