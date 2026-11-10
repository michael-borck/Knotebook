import type { StoryBible } from './bible'

export const PACK_FORMAT = 'knotebook-pack'
export const PACK_VERSION = 1

export interface PackStory {
  id: string
  title: string
  json: string
}

export interface Pack {
  format: typeof PACK_FORMAT
  version: number
  id: string
  title: string
  author: string
  licence: string
  description: string
  theme: string
  created: string
  cover?: string
  assets?: Record<string, string>
  stories: PackStory[]
}

export interface BuildPackInput {
  title: string
  author?: string
  licence?: string
  description?: string
  theme: string
  storyJson: string
  bible?: StoryBible
  cover?: string
  assets?: Record<string, string>
}

export function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'untitled'
}

export function buildPack(input: BuildPackInput): Pack {
  const title = input.title.trim() || 'Untitled Story'
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    id: slugify(title),
    title,
    author: input.author?.trim() ?? '',
    licence: input.licence?.trim() || 'CC BY 4.0',
    description: input.description?.trim() || input.bible?.premise || '',
    theme: input.theme || 'base',
    created: new Date().toISOString(),
    cover: input.cover,
    assets: input.assets,
    stories: [{ id: 'main', title, json: input.storyJson }],
  }
}

export function isPack(value: unknown): value is Pack {
  if (typeof value !== 'object' || value === null) return false
  const pack = value as Partial<Pack>
  return (
    pack.format === PACK_FORMAT &&
    typeof pack.version === 'number' &&
    typeof pack.id === 'string' &&
    typeof pack.title === 'string' &&
    typeof pack.theme === 'string' &&
    (pack.cover === undefined || typeof pack.cover === 'string') &&
    (pack.assets === undefined ||
      (typeof pack.assets === 'object' &&
        pack.assets !== null &&
        Object.values(pack.assets).every((value) => typeof value === 'string'))) &&
    Array.isArray(pack.stories) &&
    pack.stories.length > 0 &&
    pack.stories.every(
      (story) =>
        story !== null &&
        typeof story === 'object' &&
        typeof story.id === 'string' &&
        typeof story.json === 'string',
    )
  )
}

export function parsePack(text: string): {
  pack: Pack | null
  error: string | null
} {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { pack: null, error: 'That file is not valid JSON.' }
  }
  if (!isPack(value)) {
    return { pack: null, error: 'That file is not a Knotebook pack.' }
  }
  return { pack: value, error: null }
}
