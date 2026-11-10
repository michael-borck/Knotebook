import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  author: 'Pathwright',
  theme: 'noir',
  description: 'Demo pack generated from the sample story.',
  storyJson: compiled.json,
})

const packJson = JSON.stringify(pack, null, 2)
mkdirSync('public', { recursive: true })
writeFileSync('public/sample.pathwright.json', packJson)

const sha256 = createHash('sha256').update(packJson).digest('hex')
const catalogue = {
  format: 'pathwright-catalogue',
  version: 1,
  generated: new Date().toISOString(),
  packs: [
    {
      id: pack.id,
      title: pack.title,
      author: pack.author,
      theme: pack.theme,
      sha256,
      url: 'sample.pathwright.json',
      description: pack.description,
      licence: pack.licence,
    },
  ],
}
writeFileSync('public/catalogue.json', JSON.stringify(catalogue, null, 2))

console.log('Wrote public/sample.pathwright.json and public/catalogue.json')
console.log(`sha256 ${sha256}`)
