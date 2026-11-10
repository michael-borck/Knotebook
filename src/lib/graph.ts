export interface GraphNode {
  id: string
  label: string
  file: string
  line: number
  words: number
  entry: boolean
  missing: boolean
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

  for (const [file, text] of Object.entries(files)) {
    let current: string | null = null
    const lines = text.split('\n')

    lines.forEach((raw, index) => {
      const line = raw.trimEnd()
      const knotMatch = line.match(KNOT_RE)

      if (knotMatch) {
        current = knotMatch[1]
        if (!nodes.has(current)) {
          nodes.set(current, {
            id: current,
            label: current,
            file,
            line: index + 1,
            words: 0,
            entry: false,
            missing: false,
          })
        }
        firstKnot ??= current
        return
      }

      if (STITCH_RE.test(line)) return

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
        if (KEYWORD_TARGETS.has(target)) return
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
      nodes.set(edge.target, {
        id: edge.target,
        label: edge.target,
        file: '',
        line: 0,
        words: 0,
        entry: false,
        missing: true,
      })
    }
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
