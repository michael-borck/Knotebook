import { Compiler, CompilerOptions, Story } from 'inkjs/full'
import type { IFileHandler } from 'inkjs/compiler/IFileHandler'
import type { Issue, PlayView } from './types'

const MESSAGE_PATTERN = /^(ERROR|WARNING|TODO|INFO):\s*(?:line\s*(\d+):\s*)?([\s\S]*)$/i

export function parseInkMessage(raw: string, severity: Issue['severity']): Issue {
  const match = raw.match(MESSAGE_PATTERN)
  if (!match) {
    return { severity, message: raw.trim(), source: 'ink' }
  }
  const line = match[2] ? Number(match[2]) : undefined
  return {
    severity,
    message: match[3].trim() || raw.trim(),
    line,
    source: 'ink',
  }
}

export interface CompileInput {
  files?: Record<string, string>
  rootFile?: string
}

class MemoryFileHandler implements IFileHandler {
  private readonly files: Record<string, string>
  private readonly rootDir: string

  constructor(files: Record<string, string>, rootFile: string) {
    this.files = files
    this.rootDir = dirname(rootFile)
  }

  readonly ResolveInkFilename = (
    filename: string,
    sourceFilename?: string | null,
  ): string => {
    // The root parser asks for its own source file (no sourceFilename).
    if (sourceFilename == null) return normalizePath(filename)
    // INCLUDE paths resolve relative to the root file's folder, as in inklecate.
    return normalizePath(joinPath(this.rootDir, filename))
  }

  readonly LoadInkFileContents = (filename: string): string => {
    const key = normalizePath(filename)
    const contents = this.files[key]
    if (contents == null) throw new Error(`Cannot open ${filename}`)
    return contents
  }
}

export type CompileResult =
  | { ok: true; story: Story; json: string; issues: Issue[] }
  | { ok: false; issues: Issue[] }

export function compileInk(source: string, input?: CompileInput): CompileResult {
  const options =
    input?.files && input.rootFile
      ? new CompilerOptions(
          input.rootFile,
          [],
          false,
          null,
          new MemoryFileHandler(input.files, input.rootFile),
        )
      : null
  const compiler = new Compiler(source, options)
  try {
    const story = compiler.Compile()
    const issues = compiler.warnings.map((warning) =>
      parseInkMessage(warning, 'warning'),
    )
    const json = story.ToJson()
    return {
      ok: true,
      story,
      json: typeof json === 'string' ? json : '',
      issues,
    }
  } catch {
    const issues = compiler.errors.length
      ? compiler.errors.map((error) => parseInkMessage(error, 'error'))
      : [
          {
            severity: 'error' as const,
            message: 'Compilation failed.',
            source: 'ink' as const,
          },
        ]
    return { ok: false, issues }
  }
}

export function readTurn(
  story: Story,
  onPath?: (path: string | null) => void,
): PlayView {
  let text = ''
  const tags: string[] = []
  while (story.canContinue) {
    text += story.Continue() ?? ''
    onPath?.(story.state.currentPathString ?? null)
    if (story.currentTags) tags.push(...story.currentTags)
  }
  const choices = story.currentChoices.map((choice) => ({
    index: choice.index,
    text: choice.text,
  }))
  return {
    text: text.replace(/[ \t]+\n/g, '\n').replace(/\s+$/, ''),
    tags,
    choices,
    ended: choices.length === 0 && !story.canContinue,
  }
}

export function choose(
  story: Story,
  index: number,
  onPath?: (path: string | null) => void,
): PlayView {
  story.ChooseChoiceIndex(index)
  return readTurn(story, onPath)
}

export function nodeFromPath(path: string | null): string | null {
  if (!path) return null
  const [first, second] = path.split('.')
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(first)) return null
  if (second && /^[A-Za-z_][A-Za-z0-9_]*$/.test(second)) {
    return `${first}.${second}`
  }
  return first
}

function dirname(path: string): string {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? '' : normalized.slice(0, index)
}

function joinPath(base: string, name: string): string {
  return base ? `${base}/${name}` : name
}

function normalizePath(input: string): string {
  const parts = input.replace(/\\/g, '/').split('/')
  const output: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      output.pop()
      continue
    }
    output.push(part)
  }
  return output.join('/')
}
