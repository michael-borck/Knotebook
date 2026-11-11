import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Story } from 'inkjs/full'
import { buildStandaloneHtml } from '../src/lib/exportHtml'
import { choose, compileInk, nodeFromPath, readTurn } from '../src/lib/ink'
import { countWords, lintInk } from '../src/lib/lint'
import { DEFAULT_BIBLE } from '../src/lib/bible'
import { buildPack, parsePack } from '../src/lib/pack'
import { parseGraph } from '../src/lib/graph'
import { compareVersions } from '../src/lib/version'
import { extractInk } from '../src/lib/ai'
import { CATALOGUE_FORMAT, parseCatalogue, sha256Hex, verifyPackSignature } from '../src/lib/catalogue'

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
check('pack has release', pack.release === '1.0.0')
const legacyPack = { ...pack } as Record<string, unknown>
delete legacyPack.release
check(
  'legacy pack defaults release',
  parsePack(JSON.stringify(legacyPack)).pack?.release === '1.0.0',
)
check(
  'version compare',
  compareVersions('1.0.1', '1.0.0') > 0 &&
    compareVersions('1.0.0', '1.0.0') === 0 &&
    compareVersions('0.9.0', '1.0.0') < 0,
)
check(
  'extractInk fenced',
  extractInk('Here:\n```ink\n=== start ===\nHi\n```\n')?.includes(
    '=== start ===',
  ) === true,
)
check(
  'extractInk bare',
  extractInk('=== start ===\nHi\n-> END')?.includes('=== start ===') === true,
)
check('extractInk rejects prose', extractInk('Sure, here is a story.') === null)
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

const graph = parseGraph({ 'story.ink': source }, 'story.ink')
check(
  'graph finds knots',
  ['start', 'climb', 'shore', 'reach', 'keep', 'walk', 'light'].every(
    (id) => graph.nodes.some((node) => node.id === id),
  ),
)
check(
  'graph finds edges',
  graph.edges.some((edge) => edge.source === 'start' && edge.target === 'climb'),
)
check(
  'graph marks entry',
  graph.nodes.find((node) => node.id === 'start')?.entry === true,
)

const multiGraph = parseGraph(multiFiles, 'main.ink')
check(
  'graph follows includes',
  ['start', 'act1', 'act2'].every((id) =>
    multiGraph.nodes.some((node) => node.id === id),
  ),
)

const stitchFiles = {
  'main.ink':
    '-> a\n\n=== a ===\nIntro.\n-> one\n\n= one\nOne.\n-> two\n\n= two\nTwo.\n-> END\n',
}
const stitchGraph = parseGraph(stitchFiles, 'main.ink')
check(
  'graph includes stitches',
  stitchGraph.nodes.some((node) => node.id === 'a.one') &&
    stitchGraph.nodes.some((node) => node.id === 'a.two'),
)
check(
  'graph links stitches',
  stitchGraph.edges.some(
    (edge) => edge.source === 'a' && edge.target === 'a.one',
  ) &&
    stitchGraph.edges.some(
      (edge) => edge.source === 'a.one' && edge.target === 'a.two',
    ),
)

const stitchCompiled = compileInk(stitchFiles['main.ink'])
if (stitchCompiled.ok) {
  const stitchVisited = new Set<string>()
  readTurn(stitchCompiled.story, (path) => {
    const node = nodeFromPath(path)
    if (node) stitchVisited.add(node)
  })
  check('coverage includes stitch', stitchVisited.has('a.one'))
}

const coverageStory = new Story(compiled.json)
const coveredPaths = new Set<string>()
readTurn(coverageStory, (path) => {
  const knot = nodeFromPath(path)
  if (knot) coveredPaths.add(knot)
})
check('coverage captures entry knot', coveredPaths.has('start'))

const flagGraph = parseGraph(
  {
    'main.ink':
      '-> a\n\n=== a ===\nNothing happens here.\n\n=== b ===\nThe end.\n-> END\n',
  },
  'main.ink',
)
check(
  'graph detects dead end',
  flagGraph.nodes.find((node) => node.id === 'a')?.deadEnd === true,
)
check(
  'graph detects unreachable',
  flagGraph.nodes.find((node) => node.id === 'b')?.unreachable === true,
)
check(
  'graph detects terminal',
  flagGraph.nodes.find((node) => node.id === 'b')?.terminal === true,
)

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
      url: 'smoke.knotebook.json',
    },
  ],
})
check(
  'catalogue parses',
  parseCatalogue(catalogueText).catalogue?.packs.length === 1,
)
check('catalogue rejects junk', parseCatalogue('{"nope":true}').catalogue === null)

const digestBytes = new TextEncoder().encode('knotebook')
const digest = await sha256Hex(digestBytes.slice().buffer as ArrayBuffer)
const expectedDigest = createHash('sha256').update(digestBytes).digest('hex')
check('sha256 matches node', digest === expectedDigest)

const demoPackBytes = readFileSync('public/sample.knotebook.json')
const demoCatalogue = parseCatalogue(readFileSync('public/catalogue.json', 'utf8'))
const demoDigest = createHash('sha256').update(demoPackBytes).digest('hex')
check(
  'demo catalogue matches pack',
  demoCatalogue.catalogue?.packs[0]?.sha256 === demoDigest,
)
check('demo pack parses', parsePack(demoPackBytes.toString('utf8')).pack !== null)

const demoEntry = demoCatalogue.catalogue?.packs[0]
const demoPublicKey = demoCatalogue.catalogue?.publicKey
if (demoEntry?.signature && demoPublicKey) {
  const demoSignedBytes = new Uint8Array(demoPackBytes)
  check(
    'demo signature verifies',
    verifyPackSignature(
      demoEntry,
      demoSignedBytes.buffer as ArrayBuffer,
      demoPublicKey,
    ),
  )
  const tampered = new Uint8Array(demoPackBytes)
  tampered[0] ^= 1
  check(
    'demo signature rejects tamper',
    !verifyPackSignature(demoEntry, tampered.buffer as ArrayBuffer, demoPublicKey),
  )
}

if (failures.length) {
  console.error('FAILED:', failures.join(', '))
  process.exit(1)
}

console.log('smoke: ok')
console.log(`  words: ${countWords(source)}`)
console.log(`  lint issues: ${issues.length}`)
console.log(`  html bytes: ${html.length}`)
