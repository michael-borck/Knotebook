import { useEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { InkLanguageSupport } from '@mavnn/codemirror-lang-ink'
import { oneDark } from '@codemirror/theme-one-dark'
import { Story } from 'inkjs/full'
import sampleStory from './samples/story.ink?raw'
import { choose, compileInk, readTurn } from './lib/ink'
import { countWords, lintInk } from './lib/lint'
import {
  DEFAULT_BIBLE,
  buildLLMPrompt,
  type StoryBible,
} from './lib/bible'
import { buildStandaloneHtml } from './lib/exportHtml'
import inkRuntimeSource from './lib/inkRuntime'
import { openInkFile, saveHtmlFile, saveInkFile } from './lib/platform'
import type { Issue, PlayView } from './lib/types'
import './App.css'

const EMPTY_PLAY: PlayView = {
  text: '',
  tags: [],
  choices: [],
  ended: false,
}

type Tab = 'preview' | 'issues' | 'bible'

function App() {
  const [source, setSource] = useState(sampleStory)
  const [bible, setBible] = useState<StoryBible>(DEFAULT_BIBLE)
  const [bibleText, setBibleText] = useState(() =>
    JSON.stringify(DEFAULT_BIBLE, null, 2),
  )
  const [bibleError, setBibleError] = useState<string | null>(null)
  const [play, setPlay] = useState<PlayView>(EMPTY_PLAY)
  const [compiledJson, setCompiledJson] = useState<string | null>(null)
  const [compileOk, setCompileOk] = useState(true)
  const [compileIssues, setCompileIssues] = useState<Issue[]>([])
  const [lintIssues, setLintIssues] = useState<Issue[]>([])
  const [path, setPath] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('preview')
  const [toast, setToast] = useState<string | null>(null)
  const storyRef = useRef<Story | null>(null)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const result = compileInk(source)
      if (result.ok) {
        storyRef.current = result.story
        setCompiledJson(result.json)
        setCompileOk(true)
        setCompileIssues(result.issues)
        setPlay(readTurn(result.story))
      } else {
        storyRef.current = null
        setCompiledJson(null)
        setCompileOk(false)
        setCompileIssues(result.issues)
        setPlay(EMPTY_PLAY)
      }
      setLintIssues(lintInk(source, bible))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [source, bible])

  useEffect(() => {
    if (!toast) return
    const handle = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(handle)
  }, [toast])

  const issues = useMemo(
    () =>
      [...compileIssues, ...lintIssues].sort(
        (a, b) => (a.line ?? 0) - (b.line ?? 0),
      ),
    [compileIssues, lintIssues],
  )

  const errorCount = issues.filter((issue) => issue.severity === 'error').length
  const warningCount = issues.filter(
    (issue) => issue.severity === 'warning',
  ).length
  const words = useMemo(() => countWords(source), [source])
  const title = useMemo(() => {
    const match = source.match(/^#\s*title:\s*(.+)$/im)
    return match ? match[1].trim() : 'Untitled Story'
  }, [source])

  const handleChoose = (index: number) => {
    const story = storyRef.current
    if (!story) return
    setPlay(choose(story, index))
  }

  const handleRestart = () => {
    if (!compiledJson) return
    const story = new Story(compiledJson)
    storyRef.current = story
    setPlay(readTurn(story))
  }

  const handleOpen = async () => {
    const file = await openInkFile()
    if (!file) return
    setSource(file.text)
    setPath(file.path)
    setToast(`Opened ${file.path}`)
  }

  const handleSave = async () => {
    const target = await saveInkFile(path, source)
    if (!target) return
    setPath(target)
    setToast('Saved')
  }

  const handleExport = async () => {
    if (!compiledJson) return
    const html = buildStandaloneHtml({
      title,
      json: compiledJson,
      runtimeSource: inkRuntimeSource,
    })
    const target = await saveHtmlFile(title, html)
    if (target) setToast(`Exported ${target}`)
  }

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildLLMPrompt(bible, source))
      setToast('LLM prompt copied')
    } catch {
      setToast('Clipboard unavailable — select the prompt manually')
    }
  }

  const handleApplyBible = () => {
    try {
      const parsed = JSON.parse(bibleText) as StoryBible
      setBible(parsed)
      setBibleError(null)
      setToast('Story bible applied')
    } catch (error) {
      setBibleError(error instanceof Error ? error.message : 'Invalid JSON')
    }
  }

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">Pathwright</div>
        <div className="actions">
          <button type="button" onClick={handleOpen}>
            Open
          </button>
          <button type="button" onClick={handleSave}>
            Save
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={!compiledJson}
          >
            Export HTML
          </button>
          <button type="button" onClick={handleCopyPrompt}>
            Copy LLM prompt
          </button>
        </div>
        <div className="stats">
          <span className={compileOk ? 'ok' : 'bad'}>
            {compileOk ? 'Compiled' : 'Compile error'}
          </span>
          <span>{words} words</span>
          <span>{errorCount} errors</span>
          <span>{warningCount} warnings</span>
        </div>
      </header>

      <main className="workspace">
        <section className="pane editor-pane">
          <div className="pane-head">
            <span>Story</span>
            <span className="path">{path ?? 'unsaved'}</span>
          </div>
          <div className="editor">
            <CodeMirror
              value={source}
              height="100%"
              theme={oneDark}
              extensions={[InkLanguageSupport()]}
              onChange={(value) => setSource(value)}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
              }}
            />
          </div>
        </section>

        <section className="pane side-pane">
          <div className="tabs">
            <button
              type="button"
              className={tab === 'preview' ? 'active' : ''}
              onClick={() => setTab('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={tab === 'issues' ? 'active' : ''}
              onClick={() => setTab('issues')}
            >
              Issues ({issues.length})
            </button>
            <button
              type="button"
              className={tab === 'bible' ? 'active' : ''}
              onClick={() => setTab('bible')}
            >
              Bible
            </button>
          </div>
          <div className="tab-body">
            {tab === 'preview' && (
              <Preview
                play={play}
                canRestart={Boolean(compiledJson)}
                onChoose={handleChoose}
                onRestart={handleRestart}
              />
            )}
            {tab === 'issues' && <IssueList issues={issues} />}
            {tab === 'bible' && (
              <BibleEditor
                text={bibleText}
                error={bibleError}
                onChange={setBibleText}
                onApply={handleApplyBible}
              />
            )}
          </div>
        </section>
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

interface PreviewProps {
  play: PlayView
  canRestart: boolean
  onChoose: (index: number) => void
  onRestart: () => void
}

function Preview({ play, canRestart, onChoose, onRestart }: PreviewProps) {
  return (
    <div className="preview">
      <div className="story-text">
        {play.text ? (
          play.text.split(/\n{2,}/).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))
        ) : (
          <p className="muted">The story will appear here once it compiles.</p>
        )}
        {play.tags.length > 0 && (
          <div className="tag-row">
            {play.tags.map((tag, index) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="choices">
        {play.choices.map((choice) => (
          <button
            key={choice.index}
            type="button"
            className="choice"
            onClick={() => onChoose(choice.index)}
          >
            <span className="num">{choice.index + 1}</span>
            {choice.text}
          </button>
        ))}
        {play.ended && <div className="end">The End</div>}
      </div>

      <div className="preview-bar">
        <button type="button" onClick={onRestart} disabled={!canRestart}>
          Restart
        </button>
      </div>
    </div>
  )
}

function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return <div className="empty">No issues. Nice.</div>
  }
  return (
    <ul className="issues">
      {issues.map((issue, index) => (
        <li key={index} className={`issue ${issue.severity}`}>
          <span className="badge">{issue.severity}</span>
          <span className="msg">{issue.message}</span>
          {issue.line != null && <span className="line">line {issue.line}</span>}
        </li>
      ))}
    </ul>
  )
}

interface BibleEditorProps {
  text: string
  error: string | null
  onChange: (value: string) => void
  onApply: () => void
}

function BibleEditor({ text, error, onChange, onApply }: BibleEditorProps) {
  return (
    <div className="bible">
      <p className="muted">
        The story bible is the context Pathwright sends to the LLM. Edit it, then
        Apply. Lint checks tags against this list.
      </p>
      <textarea
        value={text}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <div className="bible-error">{error}</div>}
      <div className="bible-actions">
        <button type="button" onClick={onApply}>
          Apply bible
        </button>
      </div>
    </div>
  )
}

export default App
