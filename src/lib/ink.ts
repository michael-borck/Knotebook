import { Compiler, Story } from 'inkjs/full'
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

export type CompileResult =
  | { ok: true; story: Story; json: string; issues: Issue[] }
  | { ok: false; issues: Issue[] }

export function compileInk(source: string): CompileResult {
  const compiler = new Compiler(source)
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

export function readTurn(story: Story): PlayView {
  let text = ''
  const tags: string[] = []
  while (story.canContinue) {
    text += story.Continue() ?? ''
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

export function choose(story: Story, index: number): PlayView {
  story.ChooseChoiceIndex(index)
  return readTurn(story)
}
