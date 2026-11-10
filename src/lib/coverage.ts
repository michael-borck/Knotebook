const PREFIX = 'knotebook.coverage.'

export function loadCoverage(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return new Set()
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return new Set()
    return new Set(
      value.filter((item): item is string => typeof item === 'string'),
    )
  } catch {
    return new Set()
  }
}

export function saveCoverage(key: string, visited: Set<string>): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify([...visited]))
  } catch {
    // Coverage is best-effort; quota errors should not break authoring.
  }
}

export function clearCoverage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // Ignore.
  }
}
