import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import nacl from 'tweetnacl'

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index === -1 ? fallback : process.argv[index + 1]
}

const dir = resolve(arg('--dir') ?? '.')
const base = arg('--base') ?? ''
const out = resolve(arg('--out') ?? join(dir, 'catalogue.json'))
const keyPath = arg('--key')
const basePrefix = base && !base.endsWith('/') ? `${base}/` : base

function readSecretKey(path: string | undefined): Uint8Array | null {
  if (!path) return null
  try {
    const encoded = readFileSync(resolve(path), 'utf8').trim()
    if (!encoded) return null
    return new Uint8Array(Buffer.from(encoded, 'base64'))
  } catch {
    console.warn(`Could not read key: ${path}`)
    return null
  }
}

const secretKey = readSecretKey(keyPath)
const publicKey = secretKey
  ? Buffer.from(nacl.sign.keyPair.fromSecretKey(secretKey).publicKey).toString(
      'base64',
    )
  : undefined

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
  .filter((file) => file.endsWith('.knotebook.json'))
  .map((file) => {
    const text = readFileSync(file, 'utf8')
    const pack = JSON.parse(text) as {
      format?: string
      id?: string
      title?: string
      author?: string
      theme?: string
      release?: string
      description?: string
      licence?: string
    }
    if (
      pack.format !== 'knotebook-pack' ||
      typeof pack.id !== 'string' ||
      typeof pack.title !== 'string'
    ) {
      console.warn(`Skipping ${file}: not a Knotebook pack`)
      return null
    }
    const bytes = readFileSync(file)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const signature = secretKey
      ? Buffer.from(
          nacl.sign.detached(new Uint8Array(bytes), secretKey),
        ).toString('base64')
      : undefined
    const url = `${basePrefix}${relative(dir, file).replace(/\\/g, '/')}`
    return {
      id: pack.id,
      title: pack.title,
      author: pack.author ?? '',
      theme: pack.theme ?? 'base',
      release: pack.release ?? '1.0.0',
      sha256,
      url,
      description: pack.description,
      licence: pack.licence,
      signature,
    }
  })
  .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
  .sort((a, b) => a.title.localeCompare(b.title))

const catalogue = {
  format: 'knotebook-catalogue',
  version: 1,
  generated: new Date().toISOString(),
  publicKey,
  packs,
}

writeFileSync(out, JSON.stringify(catalogue, null, 2))
console.log(`Wrote ${out} with ${packs.length} pack(s)`)
if (secretKey && publicKey) {
  console.log(`Signed with public key ${publicKey}`)
} else {
  console.log('Unsigned catalogue (pass --key to sign).')
}
