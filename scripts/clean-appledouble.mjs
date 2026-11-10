import { readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const SKIP = new Set(['node_modules', '.git', 'dist', 'target'])

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(path)
    } else if (entry.name.startsWith('._')) {
      try {
        unlinkSync(path)
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

try {
  walk(process.cwd())
} catch {
  // Never fail a build because of cleanup.
}
