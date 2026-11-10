export type GraphNodeKind = 'knot' | 'stitch'

export interface GraphNode {
  id: string
  label: string
  kind: GraphNodeKind
  parent?: string
  file: string
  line: number
  words: number
  entry: boolean
  missing: boolean
  terminal: boolean
  hasChoices: boolean
  deadEnd: boolean
  unreachable: boolean
}

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

interface RawNode {
  id: string
  label: string
  kind: GraphNodeKind
  parent?: string
  file: string
  line: number
  words: number
  hasChoices: boolean
  terminal: boolean
}

interface RawEdge {
  source: string | null
  target: string
}

const KNOT_RE = /^===\s*([A-Za-z_][A-Za-z0-9_]*)\s*===\s*$/
const STITCH_RE = /^=\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/
const DIVERT_RE = /->\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)/g
const KEYWORD_TARGETS = new Set(['END', 'DONE'])
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*/g

export function parseGraph(
  files: Record<string, string>,
  rootFile?: string,
): Graph {
  const rawNodes = new Map<string, RawNode>()
  const rawEdges: RawEdge[] = []
  let firstKnot: string | null = null

  const ensureRawNode = (
    id: string,
    label: string,
    kind: GraphNodeKind,
    parent: string | undefined,
    file: string,
    line: number,
  ) => {
    const existing = rawNodes.get(id)
    if (existing) return existing
    const node: RawNode = {
      id,
      label,
      kind,
      parent,
      file,
      line,
      words: 0,
      hasChoices: false,
      terminal: false,
    }
    rawNodes.set(id, node)
    return node
  }

  for (const [file, text] of Object.entries(files)) {
    let currentKnot: string | null = null
    let currentId: string | null = null
    const lines = text.split('\n')

    lines.forEach((raw, index) => {
      const line = raw.trimEnd()
      const knotMatch = line.match(KNOT_RE)

      if (knotMatch) {
        const name = knotMatch[1]
        currentKnot = name
        currentId = name
        ensureRawNode(name, name, 'knot', undefined, file, index + 1)
        firstKnot ??= name
        return
      }

      const stitchMatch = line.match(STITCH_RE)
      if (stitchMatch) {
        if (!currentKnot) return
        const name = stitchMatch[1]
        currentId = `${currentKnot}.${name}`
        ensureRawNode(currentId, name, 'stitch', currentKnot, file, index + 1)
        return
      }

      if (currentId) {
        const node = rawNodes.get(currentId)
        if (node) {
          const trimmed = line.trimStart()
          if (trimmed.startsWith('*') || trimmed.startsWith('+')) {
            node.hasChoices = true
          }
          const prose = line.replace(/#.*$/, '').replace(/^[\s*+\-~>]+/, '').trim()
          if (
            prose &&
            !prose.startsWith('//') &&
            !prose.startsWith('VAR ') &&
            !prose.startsWith('CONST ') &&
            !prose.startsWith('INCLUDE ') &&
            !trimmed.startsWith('->')
          ) {
            const count = prose.match(WORD_RE)
            node.words += count ? count.length : 0
          }
        }
      }

      collectDiverts(line, (target) => {
        if (KEYWORD_TARGETS.has(target)) {
          if (currentId) {
            const node = rawNodes.get(currentId)
            if (node) node.terminal = true
          }
          return
        }
        rawEdges.push({ source: currentId, target })
      })
    })
  }

  const knotIds = new Set<string>()
  for (const node of rawNodes.values()) {
    if (node.kind === 'knot') knotIds.add(node.id)
  }

  const resolveTarget = (target: string, source: string | null): string => {
    if (target.includes('.')) return target
    const sourceKnot = source ? source.split('.')[0] : null
    if (sourceKnot && rawNodes.has(`${sourceKnot}.${target}`)) {
      return `${sourceKnot}.${target}`
    }
    if (knotIds.has(target)) return target
    return target
  }

  const edges: GraphEdge[] = []
  const edgeKeys = new Set<string>()
  const entries = new Set<string>()
  const addEdge = (source: string, target: string) => {
    const key = `${source}->${target}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ id: key, source, target })
  }

  for (const edge of rawEdges) {
    const resolved = resolveTarget(edge.target, edge.source)
    if (edge.source) addEdge(edge.source, resolved)
    else entries.add(resolved)
  }

  for (const edge of edges) {
    if (!rawNodes.has(edge.target)) {
      const kind: GraphNodeKind = edge.target.includes('.') ? 'stitch' : 'knot'
      ensureRawNode(
        edge.target,
        edge.target,
        kind,
        kind === 'stitch' ? edge.target.split('.')[0] : undefined,
        '',
        0,
      )
    }
  }

  const outDegree = new Map<string, number>()
  for (const edge of edges) {
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1)
  }

  const nodes: GraphNode[] = []
  for (const raw of rawNodes.values()) {
    const missing = raw.file === '' && raw.line === 0
    const deadEnd =
      !missing &&
      !raw.terminal &&
      !raw.hasChoices &&
      (outDegree.get(raw.id) ?? 0) === 0
    nodes.push({
      id: raw.id,
      label: raw.label,
      kind: raw.kind,
      parent: raw.parent,
      file: raw.file,
      line: raw.line,
      words: raw.words,
      entry: false,
      missing,
      terminal: raw.terminal,
      hasChoices: raw.hasChoices,
      deadEnd,
      unreachable: false,
    })
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const validEntries = [...entries].filter((id) => nodeById.has(id))
  if (validEntries.length > 0) {
    for (const id of validEntries) {
      const node = nodeById.get(id)
      if (node) node.entry = true
    }
  } else if (firstKnot) {
    const node = nodeById.get(firstKnot)
    if (node) node.entry = true
  }

  const entryIds = nodes.filter((node) => node.entry).map((node) => node.id)
  if (entryIds.length > 0) {
    const adjacency = new Map<string, string[]>()
    for (const edge of edges) {
      const list = adjacency.get(edge.source) ?? []
      list.push(edge.target)
      adjacency.set(edge.source, list)
    }
    const reached = new Set<string>()
    const queue = [...entryIds]
    while (queue.length > 0) {
      const id = queue.shift()
      if (!id || reached.has(id)) continue
      reached.add(id)
      for (const next of adjacency.get(id) ?? []) queue.push(next)
    }
    for (const node of nodes) {
      if (!node.missing) node.unreachable = !reached.has(node.id)
    }
  }

  void rootFile
  return { nodes, edges }
}

function collectDiverts(
  line: string,
  onTarget: (target: string) => void,
): void {
  DIVERT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = DIVERT_RE.exec(line))) {
    onTarget(match[1])
  }
}
