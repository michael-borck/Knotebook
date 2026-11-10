export function firstImageTag(tags: string[]): string | null {
  for (const tag of tags) {
    const match = /^(?:image|bg):\s*(.+)$/i.exec(tag.trim())
    if (match) return match[1].trim()
  }
  return null
}
