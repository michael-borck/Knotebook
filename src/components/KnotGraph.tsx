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
  kind: 'knot' | 'stitch'
  parent?: string
  entry: boolean
  missing: boolean
  deadEnd: boolean
  unreachable: boolean
  covered: boolean
}

const NODE_WIDTH = 176
const NODE_HEIGHT = 58
const NODE_TYPES = { knot: KnotNode }

function KnotNode({ data }: NodeProps) {
  const node = data as KnotNodeData
  const className = [
    'knot-card',
    node.kind === 'stitch' ? 'stitch' : '',
    node.missing ? 'missing' : '',
    node.deadEnd ? 'dead-end' : '',
    node.unreachable ? 'unreachable' : '',
    node.entry ? 'entry' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const meta = node.missing
    ? 'missing target'
    : node.deadEnd
      ? 'dead end'
      : node.unreachable
        ? 'unreachable'
        : node.kind === 'stitch'
          ? `${node.parent ?? 'stitch'} · ${node.words} words`
          : `${node.file} · ${node.words} words`

  return (
    <div className={className}>
      <div className="knot-title-row">
        {node.covered && <span className="knot-dot" />}
        <span className="knot-title">{node.label}</span>
      </div>
      <div className="knot-meta">{meta}</div>
    </div>
  )
}

interface KnotGraphProps {
  graph: Graph
  visited: Set<string>
  onJump: (line: number, file?: string) => void
  onResetCoverage?: () => void
}

export default function KnotGraph({
  graph,
  visited,
  onJump,
  onResetCoverage,
}: KnotGraphProps) {
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
          kind: node.kind,
          parent: node.parent,
          entry: node.entry,
          missing: node.missing,
          deadEnd: node.deadEnd,
          unreachable: node.unreachable,
          covered: visited.has(node.id),
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
  }, [graph, visited])

  const realNodes = graph.nodes.filter((node) => !node.missing)
  const coveredCount = realNodes.filter((node) => visited.has(node.id)).length

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-empty">
        No knots yet. Add <code>=== knot_name ===</code> headers to see the map.
      </div>
    )
  }

  return (
    <div className="graph-wrap">
      <div className="graph-legend">
        <span>
          <i className="lg entry" /> entry
        </span>
        <span>
          <i className="lg stitch" /> stitch
        </span>
        <span>
          <i className="lg covered" /> covered
        </span>
        <span>
          <i className="lg dead" /> dead end
        </span>
        <span>
          <i className="lg unreachable" /> unreachable
        </span>
        <span>
          <i className="lg missing" /> missing
        </span>
        <span className="legend-count">
          {coveredCount}/{realNodes.length} covered
        </span>
        {onResetCoverage && (
          <button
            type="button"
            className="legend-reset"
            onClick={onResetCoverage}
          >
            Reset
          </button>
        )}
      </div>
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
