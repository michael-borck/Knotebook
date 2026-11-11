const KNOT_RE = /^===\s*([A-Za-z_][A-Za-z0-9_]*)\s*===\s*$/
const ANY_KNOT_RE = /^===\s*[A-Za-z_][A-Za-z0-9_]*\s*===\s*$/m

export interface KnotRange {
  startLine: number
  endLine: number
}

export function knotRange(source: string, knot: string): KnotRange | null {
  const lines = source.split('\n')
  const headerName = (line: string) => {
    const match = KNOT_RE.exec(line)
    return match ? match[1] : null
  }

  let start = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (headerName(lines[index]) === knot) {
      start = index
      break
    }
  }
  if (start < 0) return null

  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    if (headerName(lines[index])) {
      end = index
      break
    }
  }
  return { startLine: start, endLine: end }
}

export function sliceKnot(source: string, knot: string): string | null {
  const range = knotRange(source, knot)
  if (!range) return null
  return source
    .split('\n')
    .slice(range.startLine, range.endLine)
    .join('\n')
    .trimEnd()
}

export function replaceKnot(
  source: string,
  knot: string,
  block: string,
): string | null {
  const range = knotRange(source, knot)
  if (!range) return null

  const text = block.trim()
  if (!text) return null

  let normalized: string | null
  if (ANY_KNOT_RE.test(text)) {
    normalized = sliceKnot(text, knot)
    if (!normalized) return null
  } else {
    normalized = `=== ${knot} ===\n${text}`
  }

  const lines = source.split('\n')
  const replacement = normalized.split('\n')
  const tail = lines.slice(range.endLine)
  if (
    tail.length > 0 &&
    replacement[replacement.length - 1].trim() !== ''
  ) {
    replacement.push('')
  }

  const joined = [
    ...lines.slice(0, range.startLine),
    ...replacement,
    ...tail,
  ].join('\n')
  return source.endsWith('\n') && !joined.endsWith('\n')
    ? `${joined}\n`
    : joined
}
