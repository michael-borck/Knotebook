import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Story } from 'inkjs/full'
import { buildStandaloneHtml } from '../src/lib/exportHtml'
import { choose, compileInk, readTurn } from '../src/lib/ink'
import { countWords, lintInk } from '../src/lib/lint'
import { DEFAULT_BIBLE } from '../src/lib/bible'
import { buildPack, parsePack } from '../src/lib/pack'
import { CATALOGUE_FORMAT, parseCatalogue, sha256Hex } from '../src/lib/catalogue'

const failures: string[] = []
function check(name: string, condition: boolean) {
  if (!condition) failures.push(name)
}

const source = readFileSync('src/samples/story.ink', 'utf8')
const compiled = compileInk(source)
check('compiles', compiled.ok)
if (!compiled.ok) {
  console.error(compiled.issues)
  process.exit(1)
}
check('json produced', compiled.json.length > 0)

const first = readTurn(compiled.story)
check('opening text', first.text.includes('harbour'))
check('opening choices', first.choices.length === 2)

const second = choose(compiled.story, 0)
check('choice advances', second.text.length > 0)

const issues = lintInk(source, DEFAULT_BIBLE)
check('no lint errors', issues.every((issue) => issue.severity !== 'error'))
check('todo detected', issues.some((issue) => issue.message.includes('TODO')))
check('word count', countWords(source) > 50)

const runtime = readFileSync('node_modules/inkjs/dist/ink.js', 'utf8')
const html = buildStandaloneHtml({
  title: 'Smoke & <Test>',
  json: compiled.json,
  runtimeSource: runtime,
})
check('html doctype', html.startsWith('<!doctype html>'))
check('html runtime inlined', html.includes('inkjs'))
check('html escaped title', html.includes('Smoke &amp; &lt;Test&gt;'))

const start = html.indexOf('var STORY_JSON=') + 'var STORY_JSON='.length
const end = html.indexOf(';var ASSETS=', start)
check('story json embedded', end > start)
const literal = html.slice(start, end)
const embeddedText = JSON.parse(literal) as string
const embeddedStory = JSON.parse(embeddedText) as { inkVersion?: number }
check('embedded json round-trips', typeof embeddedStory.inkVersion === 'number')

const pack = buildPack({
  title: 'Smoke Pack',
  author: 'Tester',
  theme: 'noir',
  storyJson: compiled.json,
})
check('pack builds', pack.id === 'smoke-pack' && pack.stories.length === 1)
const parsedPack = parsePack(JSON.stringify(pack))
check('pack round-trips', parsedPack.pack?.title === 'Smoke Pack')
check('pack rejects junk', parsePack('{"nope":true}').pack === null)

const coverData = 'data:image/png;base64,AAAA'
const assetPack = buildPack({
  title: 'Asset Pack',
  theme: 'kingdom',
  storyJson: compiled.json,
  cover: coverData,
  assets: { 'assets/cover.png': coverData },
})
const parsedAssetPack = parsePack(JSON.stringify(assetPack))
check(
  'pack keeps assets',
  parsedAssetPack.pack?.cover === coverData &&
    parsedAssetPack.pack?.assets?.['assets/cover.png'] === coverData,
)

const assetHtml = buildStandaloneHtml({
  title: 'Asset Story',
  json: compiled.json,
  runtimeSource: runtime,
  cover: coverData,
  assets: { 'assets/cover.png': coverData },
})
check(
  'html embeds assets',
  assetHtml.includes('var ASSETS=') &&
    assetHtml.includes('assets/cover.png') &&
    assetHtml.includes('id="scene"'),
)

const playerStory = new Story(pack.stories[0].json)
const playerFirst = readTurn(playerStory)
check('player opens pack', playerFirst.choices.length === 2)
choose(playerStory, 1)
const savedState = playerStory.state.ToJson()
const restored = new Story(pack.stories[0].json)
restored.state.LoadJson(savedState)
const restoredView = readTurn(restored)
check(
  'player restores progress',
  restoredView.ended || restoredView.choices.length > 0,
)

const multiFiles: Record<string, string> = {
  'main.ink':
    'INCLUDE act1.ink\n\n-> start\n\n=== start ===\nHello from main.\n-> act1\n',
  'act1.ink': 'INCLUDE act2.ink\n\n=== act1 ===\nAct one.\n-> act2\n',
  'act2.ink': '=== act2 ===\nAct two.\n-> END\n',
}
const multi = compileInk(multiFiles['main.ink'], {
  files: multiFiles,
  rootFile: 'main.ink',
})
check('multi-file compiles', multi.ok)
if (multi.ok) {
  const view = readTurn(multi.story)
  check(
    'multi-file plays',
    view.text.includes('Hello from main') && view.text.includes('Act two'),
  )
}

const subFiles: Record<string, string> = {
  'sub/main.ink': 'INCLUDE act1.ink\n\n-> start\n\n=== start ===\nSub main.\n-> act1\n',
  'sub/act1.ink': '=== act1 ===\nSub act.\n-> END\n',
}
const sub = compileInk(subFiles['sub/main.ink'], {
  files: subFiles,
  rootFile: 'sub/main.ink',
})
check('subfolder include resolves', sub.ok)

const catalogueText = JSON.stringify({
  format: CATALOGUE_FORMAT,
  version: 1,
  generated: new Date().toISOString(),
  packs: [
    {
      id: 'smoke-pack',
      title: 'Smoke Pack',
      author: 'Tester',
      theme: 'noir',
      sha256: 'abc123',
      url: 'smoke.pathwright.json',
    },
  ],
})
check(
  'catalogue parses',
  parseCatalogue(catalogueText).catalogue?.packs.length === 1,
)
check('catalogue rejects junk', parseCatalogue('{"nope":true}').catalogue === null)

const digestBytes = new TextEncoder().encode('pathwright')
const digest = await sha256Hex(digestBytes.slice().buffer as ArrayBuffer)
const expectedDigest = createHash('sha256').update(digestBytes).digest('hex')
check('sha256 matches node', digest === expectedDigest)

const demoPackBytes = readFileSync('public/sample.pathwright.json')
const demoCatalogue = parseCatalogue(readFileSync('public/catalogue.json', 'utf8'))
const demoDigest = createHash('sha256').update(demoPackBytes).digest('hex')
check(
  'demo catalogue matches pack',
  demoCatalogue.catalogue?.packs[0]?.sha256 === demoDigest,
)
check('demo pack parses', parsePack(demoPackBytes.toString('utf8')).pack !== null)

if (failures.length) {
  console.error('FAILED:', failures.join(', '))
  process.exit(1)
}

console.log('smoke: ok')
console.log(`  words: ${countWords(source)}`)
console.log(`  lint issues: ${issues.length}`)
console.log(`  html bytes: ${html.length}`)
