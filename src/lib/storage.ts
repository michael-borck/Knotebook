import type { Pack } from './pack'

const LIBRARY_KEY = 'pathwright.library.v1'

const packKey = (id: string) => `pathwright.pack.${id}`
const progressKey = (id: string) => `pathwright.progress.${id}`

export interface LibraryEntry {
  id: string
  title: string
  author: string
  theme: string
  installed: string
}

export interface SavedProgress {
  state: string
  turns: string[]
}

export function listLibrary(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    return raw ? (JSON.parse(raw) as LibraryEntry[]) : []
  } catch {
    return []
  }
}

export function installPack(pack: Pack): LibraryEntry {
  try {
    localStorage.setItem(packKey(pack.id), JSON.stringify(pack))
  } catch {
    throw new Error('Not enough local storage for this pack.')
  }
  const entry: LibraryEntry = {
    id: pack.id,
    title: pack.title,
    author: pack.author,
    theme: pack.theme,
    installed: new Date().toISOString(),
  }
  const library = listLibrary().filter((item) => item.id !== pack.id)
  library.unshift(entry)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
  return entry
}

export function loadPack(id: string): Pack | null {
  try {
    const raw = localStorage.getItem(packKey(id))
    return raw ? (JSON.parse(raw) as Pack) : null
  } catch {
    return null
  }
}

export function removePack(id: string): void {
  localStorage.removeItem(packKey(id))
  localStorage.removeItem(progressKey(id))
  const library = listLibrary().filter((item) => item.id !== id)
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library))
}

export function saveProgress(id: string, progress: SavedProgress): void {
  try {
    localStorage.setItem(progressKey(id), JSON.stringify(progress))
  } catch {
    // Progress is best-effort; a full quota should not break play.
  }
}

export function loadProgress(id: string): SavedProgress | null {
  try {
    const raw = localStorage.getItem(progressKey(id))
    return raw ? (JSON.parse(raw) as SavedProgress) : null
  } catch {
    return null
  }
}

export function clearProgress(id: string): void {
  localStorage.removeItem(progressKey(id))
}
