import type { StoryBible } from './bible'
import type { Issue } from './types'

const KNOT_PATTERN = /^===\s*([A-Za-z_][A-Za-z0-9_]*)\s*===\s*$/
const TODO_PATTERN = /\b(TODO|FIXME|XXX)\b/i
const TAG_PATTERN = /#\s*([A-Za-z][A-Za-z0-9_-]*)/g
const DIVERT_PATTERN = /->\s*([A-Za-z_][A-Za-z0-9_]*)/g

interface Knot {
  name: string
  line: number
  body: number[]
}

export function lintInk(source: string, bible: StoryBible): Issue[] {
  const issues: Issue[] = []
  const lines = source.split('\n')
  const knots: Knot[] = []
  let current: Knot | null = null

  lines.forEach((raw, index) => {
    const lineNumber = index + 1
    const line = raw.trimEnd()
    const knotMatch = line.match(KNOT_PATTERN)

    if (knotMatch) {
      current = { name: knotMatch[1], line: lineNumber, body: [] }
      knots.push(current)
    } else if (current && line.trim()) {
      current.body.push(lineNumber)
    }

    const todo = raw.match(TODO_PATTERN)
    if (todo) {
      issues.push({
        severity: 'info',
        message: `Placeholder "${todo[1]}" in the script.`,
        line: lineNumber,
        source: 'lint',
      })
    }
  })

  const seen = new Map<string, Knot>()
  for (const knot of knots) {
    const known = seen.get(knot.name)
    if (known) {
      issues.push({
        severity: 'error',
        message: `Duplicate knot "${knot.name}" (first defined on line ${known.line}).`,
        line: knot.line,
        source: 'lint',
      })
    } else {
      seen.set(knot.name, knot)
    }
    if (knot.body.length === 0) {
      issues.push({
        severity: 'warning',
        message: `Knot "${knot.name}" is empty.`,
        line: knot.line,
        source: 'lint',
      })
    }
  }

  const referenced = new Set<string>()
  for (const raw of lines) {
    let match: RegExpExecArray | null
    DIVERT_PATTERN.lastIndex = 0
    while ((match = DIVERT_PATTERN.exec(raw))) referenced.add(match[1])
  }
  const firstKnotLine = knots.length ? knots[0].line : Number.POSITIVE_INFINITY
  for (const knot of knots) {
    if (!referenced.has(knot.name) && knot.line !== firstKnotLine) {
      issues.push({
        severity: 'warning',
        message: `Knot "${knot.name}" is never targeted by a divert.`,
        line: knot.line,
        source: 'lint',
      })
    }
  }

  const allowed = new Set(bible.tags)
  const reported = new Set<string>()
  lines.forEach((raw, index) => {
    let match: RegExpExecArray | null
    TAG_PATTERN.lastIndex = 0
    while ((match = TAG_PATTERN.exec(raw))) {
      const tag = match[1]
      if (allowed.has(tag) || reported.has(tag)) continue
      reported.add(tag)
      issues.push({
        severity: 'info',
        message: `Tag "#${tag}" is not in the story bible.`,
        line: index + 1,
        source: 'lint',
      })
    }
  })

  return issues
}

export function countWords(source: string): number {
  const cleaned = source
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith('//') &&
        !line.startsWith('===') &&
        !line.startsWith('=') &&
        !line.startsWith('~') &&
        !line.startsWith('VAR ') &&
        !line.startsWith('CONST ') &&
        !line.startsWith('INCLUDE ') &&
        !line.startsWith('->'),
    )
    .map((line) => line.replace(/#.*$/, '').replace(/[*+[\]{}|~]/g, ' '))
    .join(' ')
  const matches = cleaned.match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g)
  return matches ? matches.length : 0
}
