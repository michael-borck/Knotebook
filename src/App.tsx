import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { InkLanguageSupport } from '@mavnn/codemirror-lang-ink'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView } from '@codemirror/view'
import { Story } from 'inkjs/full'
import sampleStory from './samples/story.ink?raw'
import { choose, compileInk, nodeFromPath, readTurn } from './lib/ink'
import { countWords, lintInk } from './lib/lint'
import {
  DEFAULT_BIBLE,
  buildLLMPrompt,
  type StoryBible,
} from './lib/bible'
import { buildStandaloneHtml } from './lib/exportHtml'
import inkRuntimeSource from './lib/inkRuntime'
import { THEMES, getTheme, themePalette } from './lib/themes'
import {
  backupAndWrite,
  copyFile,
  joinPath,
  listAssetFiles,
  listInkFiles,
  openInkFile,
  openProjectFolder,
  pickImageFile,
  readAssetDataUrl,
  readOptionalTextFile,
  readTextFile,
  runningInTauri,
  saveHtmlFile,
  saveInkFile,
  savePackFile,
} from './lib/platform'
import { buildPack } from './lib/pack'
import { firstImageTag } from './lib/tags'
import { parseGraph } from './lib/graph'
import KnotGraph from './components/KnotGraph'
import { clearCoverage, loadCoverage, saveCoverage } from './lib/coverage'
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
  const [projectRoot, setProjectRoot] = useState<string | null>(null)
  const [projectFiles, setProjectFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<string[]>([])
  const [previewAsset, setPreviewAsset] = useState<string | null>(null)
  const [editorView, setEditorView] = useState<'text' | 'map'>(() =>
    new URLSearchParams(window.location.search).get('view') === 'map'
      ? 'map'
      : 'text',
  )
  const [visited, setVisited] = useState<Set<string>>(() => loadCoverage('sample'))
  const visitedRef = useRef(visited)
  const [saveState, setSaveState] = useState<
    'idle' | 'saving' | 'saved' | 'unsaved' | 'error'
  >('idle')
  const storyRef = useRef<Story | null>(null)
  const editorRef = useRef<EditorView | null>(null)
  const lastSavedRef = useRef('')
  const pendingJump = useRef<number | null>(null)

  const coverageKey =
    projectRoot && activeFile
      ? `project:${projectRoot}::${activeFile}`
      : path
        ? `file:${path}`
        : 'sample'

  useEffect(() => {
    visitedRef.current = visited
  }, [visited])

  useEffect(() => {
    saveCoverage(coverageKey, visited)
  }, [coverageKey, visited])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const input =
        activeFile && Object.keys(fileContents).length > 0
          ? {
              files: { ...fileContents, [activeFile]: source },
              rootFile: activeFile,
            }
          : undefined
      const result = compileInk(source, input)
      if (result.ok) {
        storyRef.current = result.story
        setCompiledJson(result.json)
        setCompileOk(true)
        setCompileIssues(result.issues)
        const visitedPaths = new Set(visitedRef.current)
        setPlay(
          readTurn(result.story, (path) => {
            const knot = nodeFromPath(path)
            if (knot) visitedPaths.add(knot)
          }),
        )
        setVisited(visitedPaths)
      } else {
        storyRef.current = null
        setCompiledJson(null)
        setCompileOk(false)
        setCompileIssues(result.issues)
        setPlay(EMPTY_PLAY)
        setVisited(new Set())
      }
      setLintIssues(lintInk(source, bible))
    }, 250)
    return () => window.clearTimeout(handle)
  }, [source, bible, fileContents, activeFile])

  useEffect(() => {
    if (!activeFile) return
    setFileContents((previous) =>
      previous[activeFile] === source
        ? previous
        : { ...previous, [activeFile]: source },
    )
  }, [source, activeFile])

  useEffect(() => {
    let cancelled = false
    setPreviewAsset(null)
    const value = firstImageTag(play.tags)
    if (!value || !projectRoot || !runningInTauri()) return
    if (!/^assets\//i.test(value)) return
    readAssetDataUrl(joinPath(projectRoot, value))
      .then((url) => {
        if (!cancelled) setPreviewAsset(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [play.tags, projectRoot])

  useEffect(() => {
    if (!toast) return
    const handle = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(handle)
  }, [toast])

  useEffect(() => {
    if (!projectRoot || !activeFile || !runningInTauri()) return
    if (source === lastSavedRef.current) return
    setSaveState('unsaved')
    const handle = window.setTimeout(async () => {
      setSaveState('saving')
      try {
        await backupAndWrite(
          joinPath(projectRoot, activeFile),
          source,
          joinPath(projectRoot, '.knotebook/backups'),
        )
        lastSavedRef.current = source
        setSaveState('saved')
      } catch {
        setSaveState('error')
        setToast('Autosave failed')
      }
    }, 900)
    return () => window.clearTimeout(handle)
  }, [source, projectRoot, activeFile])

  useEffect(() => {
    if (!projectRoot || !runningInTauri()) return
    const handle = window.setTimeout(() => {
      void backupAndWrite(
        joinPath(projectRoot, 'knotebook.bible.json'),
        JSON.stringify(bible, null, 2),
        joinPath(projectRoot, '.knotebook/backups'),
      ).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(handle)
  }, [bible, projectRoot])

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

  const theme = useMemo(() => getTheme(bible.theme), [bible.theme])
  const palette = useMemo(() => themePalette(theme), [theme])
  const coverAsset = useMemo(
    () =>
      assets.find((asset) =>
        /(^|\/)cover\.(png|jpe?g|gif|webp|avif)$/i.test(asset),
      ) ?? null,
    [assets],
  )

  const graph = useMemo(() => {
    if (activeFile && Object.keys(fileContents).length > 0) {
      return parseGraph(
        { ...fileContents, [activeFile]: source },
        activeFile,
      )
    }
    return parseGraph({ 'story.ink': source }, 'story.ink')
  }, [source, fileContents, activeFile])
  const previewStyle = useMemo(
    () =>
      ({
        '--bg': palette.bg,
        '--panel': palette.panel,
        '--panel-2': palette.panel2,
        '--text': palette.text,
        '--muted': palette.muted,
        '--border': palette.border,
        '--accent': palette.accent,
      }) as CSSProperties,
    [palette],
  )

  const handleChoose = (index: number) => {
    const story = storyRef.current
    if (!story) return
    const visitedPaths = new Set(visited)
    const next = choose(story, index, (path) => {
      const knot = nodeFromPath(path)
      if (knot) visitedPaths.add(knot)
    })
    setPlay(next)
    setVisited(visitedPaths)
  }

  const handleRestart = () => {
    if (!compiledJson) return
    const story = new Story(compiledJson)
    storyRef.current = story
    setVisited(new Set())
    clearCoverage(coverageKey)
    const visitedPaths = new Set<string>()
    setPlay(
      readTurn(story, (path) => {
        const knot = nodeFromPath(path)
        if (knot) visitedPaths.add(knot)
      }),
    )
    setVisited(visitedPaths)
  }

  const handleJump = (line: number) => {
    const view = editorRef.current
    if (!view) return
    const target = Math.min(Math.max(1, line), view.state.doc.lines)
    const info = view.state.doc.line(target)
    view.dispatch({
      selection: { anchor: info.from, head: info.to },
      effects: EditorView.scrollIntoView(info.from, { y: 'center' }),
    })
    view.focus()
  }

  const handleThemeChange = (id: string) => {
    const next = { ...bible, theme: id }
    setBible(next)
    setBibleText(JSON.stringify(next, null, 2))
  }

  const loadProjectFile = async (
    root: string,
    relative: string,
    files?: string[],
  ) => {
    // Flush the outgoing file before switching, so a quick click cannot drop
    // edits whose autosave timer has not fired yet.
    if (
      projectRoot &&
      activeFile &&
      runningInTauri() &&
      source !== lastSavedRef.current
    ) {
      try {
        await backupAndWrite(
          joinPath(projectRoot, activeFile),
          source,
          joinPath(projectRoot, '.knotebook/backups'),
        )
        lastSavedRef.current = source
      } catch {
        // Keep switching; the next save can retry.
      }
    }
    const text = await readTextFile(joinPath(root, relative))
    lastSavedRef.current = text
    setProjectRoot(root)
    setProjectFiles(files ?? projectFiles)
    setActiveFile(relative)
    setPath(joinPath(root, relative))
    setVisited(loadCoverage(`project:${root}::${relative}`))
    setSource(text)
    setSaveState('saved')
  }

  const handleOpenProject = async () => {
    if (!runningInTauri()) {
      setToast('Folder projects need the desktop app')
      return
    }
    const root = await openProjectFolder()
    if (!root) return
    const files = await listInkFiles(root)
    if (files.length === 0) {
      setToast('No .ink files found in that folder')
      return
    }
    const preferred =
      files.find((file) => /(^|\/)main\.ink$/i.test(file)) ?? files[0]
    const contents: Record<string, string> = {}
    await Promise.all(
      files.map(async (relative) => {
        try {
          contents[relative] = await readTextFile(joinPath(root, relative))
        } catch {
          // Unreadable files are reported by the compiler as missing includes.
        }
      }),
    )
    setFileContents(contents)
    const assetFiles = await listAssetFiles(root)
    setAssets(assetFiles)
    setPreviewAsset(null)
    await loadProjectFile(root, preferred, files)
    const bibleRaw = await readOptionalTextFile(
      joinPath(root, 'knotebook.bible.json'),
    )
    if (!bibleRaw) return
    try {
      const parsed = JSON.parse(bibleRaw) as StoryBible
      setBible(parsed)
      setBibleText(JSON.stringify(parsed, null, 2))
    } catch {
      setToast('Could not read knotebook.bible.json')
    }
  }

  const handleOpenFile = async (relative: string) => {
    if (!projectRoot) return
    await loadProjectFile(projectRoot, relative)
  }

  const handleAddImage = async () => {
    if (!projectRoot || !runningInTauri()) {
      setToast('Add images from the desktop app')
      return
    }
    const sourcePath = await pickImageFile()
    if (!sourcePath) return
    const name = sourcePath.split(/[\\/]/).pop()
    if (!name) return
    try {
      await copyFile(sourcePath, joinPath(projectRoot, `assets/${name}`))
      setAssets(await listAssetFiles(projectRoot))
      setToast(`Added ${name}`)
    } catch {
      setToast('Could not add that image')
    }
  }

  const handleCopyAsset = async (asset: string) => {
    try {
      await navigator.clipboard.writeText(asset)
      setToast(`Copied ${asset}`)
    } catch {
      setToast('Clipboard unavailable')
    }
  }

  const handleGraphJump = async (line: number, file?: string) => {
    if (file && projectRoot && file !== activeFile && file !== 'story.ink') {
      await loadProjectFile(projectRoot, file)
    }
    pendingJump.current = line
    setEditorView('text')
  }

  useEffect(() => {
    if (editorView !== 'text' || pendingJump.current == null) return
    const line = pendingJump.current
    pendingJump.current = null
    const handle = window.setTimeout(() => handleJump(line), 60)
    return () => window.clearTimeout(handle)
  }, [editorView])

  const handleResetCoverage = () => {
    setVisited(new Set())
    clearCoverage(coverageKey)
    setToast('Coverage reset')
  }

  const handleOpen = async () => {
    const file = await openInkFile()
    if (!file) return
    setProjectRoot(null)
    setProjectFiles([])
    setActiveFile(null)
    setFileContents({})
    setAssets([])
    setPreviewAsset(null)
    setVisited(loadCoverage(`file:${file.path}`))
    setSource(file.text)
    setPath(file.path)
    setToast(`Opened ${file.path}`)
  }

  const handleSave = async () => {
    if (projectRoot && activeFile && runningInTauri()) {
      try {
        await backupAndWrite(
          joinPath(projectRoot, activeFile),
          source,
          joinPath(projectRoot, '.knotebook/backups'),
        )
        lastSavedRef.current = source
        setSaveState('saved')
        setToast('Saved')
      } catch {
        setSaveState('error')
        setToast('Save failed')
      }
      return
    }
    const target = await saveInkFile(path, source)
    if (!target) return
    setPath(target)
    setToast('Saved')
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const collectProjectAssets = async () => {
    const assetData: Record<string, string> = {}
    let cover: string | undefined
    if (projectRoot && runningInTauri()) {
      for (const asset of assets) {
        try {
          const dataUrl = await readAssetDataUrl(joinPath(projectRoot, asset))
          assetData[asset] = dataUrl
          if (asset === coverAsset) cover = dataUrl
        } catch {
          // Skip unreadable assets; the artifact is still buildable.
        }
      }
    }
    return { assetData, cover }
  }

  const handleExport = async () => {
    if (!compiledJson) return
    const { assetData, cover } = await collectProjectAssets()
    const html = buildStandaloneHtml({
      title,
      json: compiledJson,
      runtimeSource: inkRuntimeSource,
      theme: palette,
      cover,
      assets: assetData,
    })
    const target = await saveHtmlFile(title, html)
    if (target) setToast(`Exported ${target}`)
  }

  const handleBuildPack = async () => {
    if (!compiledJson) return
    const author = source.match(/^#\s*author:\s*(.+)$/im)?.[1].trim() ?? ''
    const { assetData, cover } = await collectProjectAssets()
    const pack = buildPack({
      title,
      author,
      description: bible.premise,
      theme: bible.theme,
      storyJson: compiledJson,
      bible,
      cover,
      assets: assetData,
    })
    const json = JSON.stringify(pack, null, 2)
    if (json.length > 16_000_000) {
      setToast('Pack is too large (16 MB). Remove some assets.')
      return
    }
    const target = await savePackFile(title, json)
    if (target) setToast(`Pack saved ${target}`)
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
        <div className="brand">Knotebook</div>
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
          <button
            type="button"
            onClick={handleBuildPack}
            disabled={!compiledJson}
          >
            Build pack
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = '?player=1'
            }}
          >
            Player
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
        <aside className="pane project-pane">
          <div className="pane-head">
            <span>Project</span>
            {projectRoot && (
              <span className={`save ${saveState}`}>{saveState}</span>
            )}
          </div>
          <div className="project-body">
            <button
              type="button"
              className="open-project"
              onClick={() => void handleOpenProject()}
            >
              {projectRoot ? 'Open another folder…' : 'Open folder…'}
            </button>
            {projectRoot && (
              <p className="project-root" title={projectRoot}>
                {projectRoot}
              </p>
            )}
            <ul className="file-list">
              {projectFiles.map((file) => (
                <li key={file}>
                  <button
                    type="button"
                    className={file === activeFile ? 'active' : ''}
                    onClick={() => void handleOpenFile(file)}
                  >
                    {file}
                  </button>
                </li>
              ))}
            </ul>
            <div className="section-label">
              <span>Assets</span>
              <button
                type="button"
                className="mini"
                onClick={() => void handleAddImage()}
              >
                Add image…
              </button>
            </div>
            {coverAsset && <p className="project-root">Cover: {coverAsset}</p>}
            <ul className="file-list">
              {assets.map((asset) => (
                <li key={asset}>
                  <button
                    type="button"
                    title="Copy asset path"
                    onClick={() => void handleCopyAsset(asset)}
                  >
                    {asset.replace(/^assets\//, '')}
                  </button>
                </li>
              ))}
              {assets.length === 0 && (
                <li className="muted small">No images yet.</li>
              )}
            </ul>
          </div>
        </aside>

        <section className="pane editor-pane">
          <div className="pane-head">
            <span>Story</span>
            <div className="view-toggle">
              <button
                type="button"
                className={editorView === 'text' ? 'active' : ''}
                onClick={() => setEditorView('text')}
              >
                Text
              </button>
              <button
                type="button"
                className={editorView === 'map' ? 'active' : ''}
                onClick={() => setEditorView('map')}
              >
                Map
              </button>
            </div>
            <span className="path">{path ?? 'unsaved'}</span>
            {saveState !== 'idle' && (
              <span className={`save ${saveState}`}>{saveState}</span>
            )}
          </div>
          <div className={editorView === 'text' ? 'editor' : 'graph-pane'}>
            {editorView === 'text' ? (
              <CodeMirror
                value={source}
                height="100%"
                theme={oneDark}
                extensions={[InkLanguageSupport()]}
                onChange={(value) => setSource(value)}
                onCreateEditor={(view) => {
                  editorRef.current = view
                }}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                }}
              />
            ) : (
              <KnotGraph
                graph={graph}
                visited={visited}
                onJump={(line, file) => void handleGraphJump(line, file)}
                onResetCoverage={handleResetCoverage}
              />
            )}
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
                themeStyle={previewStyle}
                imageUrl={previewAsset}
              />
            )}
            {tab === 'issues' && (
              <IssueList issues={issues} onJump={handleJump} />
            )}
            {tab === 'bible' && (
              <BibleEditor
                text={bibleText}
                error={bibleError}
                themeId={bible.theme}
                themeHint={theme.hint}
                onChange={setBibleText}
                onThemeChange={handleThemeChange}
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
  themeStyle: CSSProperties
  imageUrl: string | null
}

function Preview({
  play,
  canRestart,
  onChoose,
  onRestart,
  themeStyle,
  imageUrl,
}: PreviewProps) {
  return (
    <div className="preview" style={themeStyle}>
      {imageUrl && <img className="preview-image" src={imageUrl} alt="" />}
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

function IssueList({
  issues,
  onJump,
}: {
  issues: Issue[]
  onJump: (line: number) => void
}) {
  if (issues.length === 0) {
    return <div className="empty">No issues. Nice.</div>
  }
  return (
    <ul className="issues">
      {issues.map((issue, index) => (
        <li key={index} className={`issue ${issue.severity}`}>
          <span className="badge">{issue.severity}</span>
          <span className="msg">{issue.message}</span>
          {issue.line != null && (
            <button
              type="button"
              className="line"
              onClick={() => onJump(issue.line ?? 1)}
            >
              line {issue.line}
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

interface BibleEditorProps {
  text: string
  error: string | null
  themeId: string
  themeHint: string
  onChange: (value: string) => void
  onThemeChange: (id: string) => void
  onApply: () => void
}

function BibleEditor({
  text,
  error,
  themeId,
  themeHint,
  onChange,
  onThemeChange,
  onApply,
}: BibleEditorProps) {
  return (
    <div className="bible">
      <label className="bible-theme">
        <span>Theme</span>
        <select
          value={themeId}
          onChange={(event) => onThemeChange(event.target.value)}
        >
          {THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.title}
            </option>
          ))}
        </select>
        <span className="muted">{themeHint}</span>
      </label>
      <p className="muted">
        The story bible is the context Knotebook sends to the LLM. Edit it, then
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
