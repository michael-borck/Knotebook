export interface GraphNode {
  id: string
  label: string
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

const KNOT_RE = /^===\s*([A-Za-z_][A-Za-z0-9_]*)\s*===\s*$/
const STITCH_RE = /^=\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*$/
const DIVERT_RE = /->\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)?)/g
const KEYWORD_TARGETS = new Set(['END', 'DONE'])
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'’-]*/g

export function parseGraph(
  files: Record<string, string>,
  rootFile?: string,
): Graph {
  const nodes = new Map<string, GraphNode>()
  const words = new Map<string, number>()
  const hasChoices = new Set<string>()
  const terminal = new Set<string>()
  const edges: GraphEdge[] = []
  const edgeKeys = new Set<string>()
  const entries = new Set<string>()
  let firstKnot: string | null = null

  const addEdge = (source: string, target: string) => {
    const key = `${source}->${target}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ id: key, source, target })
  }

  const ensureNode = (id: string, file: string, line: number) => {
    if (nodes.has(id)) return nodes.get(id)!
    const node: GraphNode = {
      id,
      label: id,
      file,
      line,
      words: 0,
      entry: false,
      missing: false,
      terminal: false,
      hasChoices: false,
      deadEnd: false,
      unreachable: false,
    }
    nodes.set(id, node)
    return node
  }

  for (const [file, text] of Object.entries(files)) {
    let current: string | null = null
    const lines = text.split('\n')

    lines.forEach((raw, index) => {
      const line = raw.trimEnd()
      const knotMatch = line.match(KNOT_RE)

      if (knotMatch) {
        current = knotMatch[1]
        ensureNode(current, file, index + 1)
        firstKnot ??= current
        return
      }

      if (STITCH_RE.test(line)) return

      if (current && (line.trimStart().startsWith('*') || line.trimStart().startsWith('+'))) {
        hasChoices.add(current)
      }

      if (current) {
        const prose = line.replace(/#.*$/, '').replace(/^[\s*+\-~>]+/, '').trim()
        if (
          prose &&
          !prose.startsWith('//') &&
          !prose.startsWith('VAR ') &&
          !prose.startsWith('CONST ') &&
          !prose.startsWith('INCLUDE ')
        ) {
          const count = prose.match(WORD_RE)
          words.set(
            current,
            (words.get(current) ?? 0) + (count ? count.length : 0),
          )
        }
      }

      collectDiverts(line, (target) => {
        if (KEYWORD_TARGETS.has(target)) {
          if (current) terminal.add(current)
          return
        }
        if (current) addEdge(current, target)
        else entries.add(target)
      })
    })
  }

  for (const [id, count] of words) {
    const node = nodes.get(id)
    if (node) node.words = count
  }

  for (const edge of edges) {
    if (!nodes.has(edge.target)) {
      const node = ensureNode(edge.target, '', 0)
      node.missing = true
    }
  }

  const outDegree = new Map<string, number>()
  for (const edge of edges) {
    outDegree.set(edge.source, (outDegree.get(edge.source) ?? 0) + 1)
  }

  for (const node of nodes.values()) {
    if (node.missing) continue
    node.terminal = terminal.has(node.id)
    node.hasChoices = hasChoices.has(node.id)
    node.deadEnd =
      !node.terminal &&
      !node.hasChoices &&
      (outDegree.get(node.id) ?? 0) === 0
  }

  const validEntries = [...entries].filter((id) => {
    const node = nodes.get(id)
    return node && !node.missing
  })
  if (validEntries.length > 0) {
    for (const id of validEntries) {
      const node = nodes.get(id)
      if (node) node.entry = true
    }
  } else if (firstKnot) {
    const node = nodes.get(firstKnot)
    if (node) node.entry = true
  }

  const entryIds = [...nodes.values()]
    .filter((node) => node.entry)
    .map((node) => node.id)
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
    for (const node of nodes.values()) {
      if (!node.missing) node.unreachable = !reached.has(node.id)
    }
  }

  void rootFile
  return { nodes: [...nodes.values()], edges }
}

function collectDiverts(
  line: string,
  onTarget: (target: string) => void,
): void {
  DIVERT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = DIVERT_RE.exec(line))) {
    onTarget(match[1].split('.')[0])
  }
}
