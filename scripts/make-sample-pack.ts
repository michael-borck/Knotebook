import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import nacl from 'tweetnacl'
import { compileInk } from '../src/lib/ink'
import { buildPack } from '../src/lib/pack'

const source = readFileSync('src/samples/story.ink', 'utf8')
const compiled = compileInk(source)
if (!compiled.ok) {
  console.error(compiled.issues)
  process.exit(1)
}

const titleMatch = source.match(/^#\s*title:\s*(.+)$/im)
const title = titleMatch ? titleMatch[1].trim() : 'The Lantern Keepers'
const pack = buildPack({
  title,
  release: '1.0.0',
  author: 'Knotebook',
  theme: 'noir',
  description: 'Demo pack generated from the sample story.',
  storyJson: compiled.json,
})

const packJson = JSON.stringify(pack, null, 2)
mkdirSync('public', { recursive: true })
writeFileSync('public/sample.knotebook.json', packJson)

let publicKey: string | undefined
let signature: string | undefined
const secretPath = 'keys/store-secret.txt'
if (existsSync(secretPath)) {
  const secret = new Uint8Array(
    Buffer.from(readFileSync(secretPath, 'utf8').trim(), 'base64'),
  )
  const keyPair = nacl.sign.keyPair.fromSecretKey(secret)
  publicKey = Buffer.from(keyPair.publicKey).toString('base64')
  signature = Buffer.from(
    nacl.sign.detached(new Uint8Array(Buffer.from(packJson, 'utf8')), secret),
  ).toString('base64')
}

const sha256 = createHash('sha256').update(packJson).digest('hex')
const catalogue = {
  format: 'knotebook-catalogue',
  version: 1,
  generated: new Date().toISOString(),
  publicKey,
  packs: [
    {
      id: pack.id,
      title: pack.title,
      author: pack.author,
      theme: pack.theme,
      release: pack.release,
      sha256,
      url: 'sample.knotebook.json',
      description: pack.description,
      licence: pack.licence,
      signature,
    },
  ],
}
writeFileSync('public/catalogue.json', JSON.stringify(catalogue, null, 2))

console.log('Wrote public/sample.knotebook.json and public/catalogue.json')
console.log(`sha256 ${sha256}`)
console.log(signature ? 'Signed demo pack' : 'Unsigned demo pack (no key)')
