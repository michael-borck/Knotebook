import { useMemo } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import dagre from 'dagre'
import type { Graph } from '../lib/graph'
import '@xyflow/react/dist/style.css'

export interface KnotNodeData extends Record<string, unknown> {
  label: string
  file: string
  line: number
  words: number
  entry: boolean
  missing: boolean
}

const NODE_WIDTH = 176
const NODE_HEIGHT = 58
const NODE_TYPES = { knot: KnotNode }

function KnotNode({ data }: NodeProps) {
  const node = data as KnotNodeData
  const className = [
    'knot-card',
    node.entry ? 'entry' : '',
    node.missing ? 'missing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className}>
      <div className="knot-title">{node.label}</div>
      <div className="knot-meta">
        {node.missing
          ? 'missing target'
          : `${node.file} · ${node.words} words`}
      </div>
    </div>
  )
}

interface KnotGraphProps {
  graph: Graph
  onJump: (line: number, file?: string) => void
}

export default function KnotGraph({ graph, onJump }: KnotGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const layout = new dagre.graphlib.Graph()
    layout.setGraph({
      rankdir: 'LR',
      nodesep: 36,
      ranksep: 80,
      marginx: 24,
      marginy: 24,
    })
    layout.setDefaultEdgeLabel(() => ({}))

    for (const node of graph.nodes) {
      layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
    }
    for (const edge of graph.edges) {
      if (edge.source !== edge.target) layout.setEdge(edge.source, edge.target)
    }
    dagre.layout(layout)

    const nodes: Node<KnotNodeData>[] = graph.nodes.map((node) => {
      const position = layout.node(node.id)
      return {
        id: node.id,
        type: 'knot',
        position: {
          x: (position?.x ?? 0) - NODE_WIDTH / 2,
          y: (position?.y ?? 0) - NODE_HEIGHT / 2,
        },
        data: {
          label: node.label,
          file: node.file,
          line: node.line,
          words: node.words,
          entry: node.entry,
          missing: node.missing,
        },
        style: { width: NODE_WIDTH, height: NODE_HEIGHT },
      }
    })

    const edges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6b7085' },
      style: { stroke: '#6b7085', strokeWidth: 1.4 },
    }))

    return { nodes, edges }
  }, [graph])

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        No knots yet. Add <code>=== knot_name ===</code> headers to see the map.
      </div>
    )
  }

  return (
    <div className="graph-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          const data = node.data as KnotNodeData
          if (data.line > 0) onJump(data.line, data.file)
        }}
      >
        <Background color="#232633" gap={20} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor="#2a2d3a"
          maskColor="rgba(16,17,23,0.85)"
        />
      </ReactFlow>
    </div>
  )
}
