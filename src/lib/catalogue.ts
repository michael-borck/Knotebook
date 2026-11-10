export const CATALOGUE_FORMAT = 'pathwright-catalogue'
export const CATALOGUE_VERSION = 1

export interface CatalogueEntry {
  id: string
  title: string
  author: string
  theme: string
  sha256: string
  url: string
  description?: string
  licence?: string
}

export interface Catalogue {
  format: typeof CATALOGUE_FORMAT
  version: number
  generated: string
  packs: CatalogueEntry[]
}

function isEntry(value: unknown): value is CatalogueEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<CatalogueEntry>
  return (
    typeof entry.id === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.theme === 'string' &&
    typeof entry.sha256 === 'string' &&
    typeof entry.url === 'string'
  )
}

export function isCatalogue(value: unknown): value is Catalogue {
  if (typeof value !== 'object' || value === null) return false
  const catalogue = value as Partial<Catalogue>
  return (
    catalogue.format === CATALOGUE_FORMAT &&
    typeof catalogue.version === 'number' &&
    Array.isArray(catalogue.packs) &&
    catalogue.packs.every(isEntry)
  )
}

export function parseCatalogue(text: string): {
  catalogue: Catalogue | null
  error: string | null
} {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { catalogue: null, error: 'That catalogue is not valid JSON.' }
  }
  if (!isCatalogue(value)) {
    return { catalogue: null, error: 'That file is not a Pathwright catalogue.' }
  }
  return { catalogue: value, error: null }
}

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 verification is unavailable in this context.')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function fetchPackBytes(
  entry: CatalogueEntry,
  catalogueUrl: string,
): Promise<ArrayBuffer> {
  const url = new URL(entry.url, catalogueUrl).toString()
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Pack download failed (${response.status}).`)
  }
  return response.arrayBuffer()
}
