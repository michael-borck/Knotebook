import type { StoryBible } from './bible'

export type AiProvider = 'ollama' | 'openai'

export interface AiSettings {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
}

export const AI_SETTINGS_KEY = 'knotebook.ai.settings.v1'

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  model: 'gemma3:4b',
  apiKey: '',
}

export const PROVIDER_DEFAULTS: Record<
  AiProvider,
  Pick<AiSettings, 'baseUrl' | 'model'>
> = {
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'gemma3:4b' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_AI_SETTINGS }
    const value = JSON.parse(raw) as Partial<AiSettings>
    return {
      provider: value.provider === 'openai' ? 'openai' : 'ollama',
      baseUrl:
        typeof value.baseUrl === 'string' && value.baseUrl
          ? value.baseUrl
          : DEFAULT_AI_SETTINGS.baseUrl,
      model:
        typeof value.model === 'string' && value.model
          ? value.model
          : DEFAULT_AI_SETTINGS.model,
      apiKey: typeof value.apiKey === 'string' ? value.apiKey : '',
    }
  } catch {
    return { ...DEFAULT_AI_SETTINGS }
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Settings are best-effort.
  }
}

export function extractInk(text: string): string | null {
  const fenced = /```(?:ink)?\s*\n([\s\S]*?)```/i.exec(text)
  if (fenced) return fenced[1].trim()

  const trimmed = text.trim()
  if (/(^|\n)\s*(===|->)/.test(trimmed)) return trimmed
  return null
}

const SYSTEM_PROMPT = `You are an expert interactive fiction writer and an expert in ink, inkle's narrative scripting language.

You will receive a story bible and the current ink source. Return ONLY the complete revised ink source in a single fenced code block tagged ink.

Preserve existing knot names and the bible's conventions unless the task explicitly changes them. Do not add commentary outside the code block.`

export interface GenerateOptions {
  settings: AiSettings
  bible: StoryBible
  source: string
  instruction: string
  signal?: AbortSignal
}

export async function generateInk(options: GenerateOptions): Promise<string> {
  const { settings, bible, source, instruction, signal } = options
  const baseUrl = settings.baseUrl.replace(/\/+$/, '')
  const task =
    instruction.trim() ||
    'Continue and improve the story while preserving the conventions.'

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(settings.apiKey.trim()
        ? { Authorization: `Bearer ${settings.apiKey.trim()}` }
        : {}),
    },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            'Story bible (JSON):',
            JSON.stringify(bible, null, 2),
            '',
            'Current ink source:',
            '```ink',
            source,
            '```',
            '',
            'Task:',
            task,
          ].join('\n'),
        },
      ],
    }),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400)
    throw new Error(`AI request failed (${response.status}). ${detail}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>
  }
  const content = data.choices?.[0]?.message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              part && typeof part === 'object' && 'text' in part
                ? String((part as { text: unknown }).text)
                : '',
            )
            .join('')
        : ''

  const ink = extractInk(text)
  if (!ink) throw new Error('The model did not return an ink code block.')
  return ink
}
