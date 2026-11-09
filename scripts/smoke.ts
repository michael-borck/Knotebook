import { readFileSync } from 'node:fs'
import { buildStandaloneHtml } from '../src/lib/exportHtml'
import { choose, compileInk, readTurn } from '../src/lib/ink'
import { countWords, lintInk } from '../src/lib/lint'
import { DEFAULT_BIBLE } from '../src/lib/bible'

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
const end = html.indexOf('</script>', start)
const segment = html.slice(start, end)
const cut = segment.search(/;\s*\(function/)
check('story json embedded', cut > 0)
const literal = segment.slice(0, cut)
const embeddedText = JSON.parse(literal) as string
const embeddedStory = JSON.parse(embeddedText) as { inkVersion?: number }
check('embedded json round-trips', typeof embeddedStory.inkVersion === 'number')

if (failures.length) {
  console.error('FAILED:', failures.join(', '))
  process.exit(1)
}

console.log('smoke: ok')
console.log(`  words: ${countWords(source)}`)
console.log(`  lint issues: ${issues.length}`)
console.log(`  html bytes: ${html.length}`)
