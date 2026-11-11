export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .split(/[.+-]/)
      .map((part) => Number.parseInt(part, 10))
      .filter((part) => Number.isFinite(part))

  const left = parse(a.trim())
  const right = parse(b.trim())
  if (left.length === 0 || right.length === 0) {
    return a.trim().localeCompare(b.trim())
  }

  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0
    const r = right[index] ?? 0
    if (l !== r) return l < r ? -1 : 1
  }
  return 0
}
