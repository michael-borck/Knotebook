import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const dir = resolve(arg('--dir') ?? '.')
const base = arg('--base') ?? ''
const out = resolve(arg('--out') ?? join(dir, 'catalogue.json'))
const basePrefix = base && !base.endsWith('/') ? `${base}/` : base

function collect(folder: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
    const path = join(folder, entry.name)
    if (entry.isDirectory()) files.push(...collect(path))
    else if (entry.isFile()) files.push(path)
  }
  return files
}

const packs = collect(dir)
  .filter((file) => file.endsWith('.pathwright.json'))
  .map((file) => {
    const text = readFileSync(file, 'utf8')
    const pack = JSON.parse(text) as {
      format?: string
      id?: string
      title?: string
      author?: string
      theme?: string
      description?: string
      licence?: string
    }
    if (
      pack.format !== 'pathwright-pack' ||
      typeof pack.id !== 'string' ||
      typeof pack.title !== 'string'
    ) {
      console.warn(`Skipping ${file}: not a Pathwright pack`)
      return null
    }
    const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex')
    const url = `${basePrefix}${relative(dir, file).replace(/\\/g, '/')}`
    return {
      id: pack.id,
      title: pack.title,
      author: pack.author ?? '',
      theme: pack.theme ?? 'base',
      sha256,
      url,
      description: pack.description,
      licence: pack.licence,
    }
  })
  .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  .sort((a, b) => a.title.localeCompare(b.title))

const catalogue = {
  format: 'pathwright-catalogue',
  version: 1,
  generated: new Date().toISOString(),
  packs,
}

writeFileSync(out, JSON.stringify(catalogue, null, 2))
console.log(`Wrote ${out} with ${packs.length} pack(s)`)
