const PREFIX = 'knotebook.snapshots.'

export interface Snapshot {
  at: string
  source: string
  label: string
}

export function loadSnapshots(key: string): Snapshot[] {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return []
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is Snapshot =>
        item !== null &&
        typeof item === 'object' &&
        typeof (item as Snapshot).at === 'string' &&
        typeof (item as Snapshot).source === 'string' &&
        typeof (item as Snapshot).label === 'string',
    )
  } catch {
    return []
  }
}

export function saveSnapshot(
  key: string,
  source: string,
  label: string,
): Snapshot[] {
  const current = loadSnapshots(key)
  if (current[0]?.source === source) return current
  const next = [
    { at: new Date().toISOString(), source, label },
    ...current,
  ].slice(0, 10)
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(next))
  } catch {
    // History is best-effort.
  }
  return next
}

export function clearSnapshots(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore.
  }
}
