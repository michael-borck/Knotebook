import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { Story } from 'inkjs/full'
import { choose, readTurn } from './lib/ink'
import { getTheme, themePalette } from './lib/themes'
import { parsePack, type Pack } from './lib/pack'
import {
  clearProgress,
  installPack,
  listLibrary,
  loadPack,
  loadProgress,
  removePack,
  saveProgress,
  type LibraryEntry,
} from './lib/storage'
import type { PlayView } from './lib/types'
import './player.css'

const EMPTY_PLAY: PlayView = { text: '', tags: [], choices: [], ended: false }

export default function Player() {
  const [library, setLibrary] = useState<LibraryEntry[]>(() => listLibrary())
  const [pack, setPack] = useState<Pack | null>(null)
  const [turns, setTurns] = useState<string[]>([])
  const [play, setPlay] = useState<PlayView>(EMPTY_PLAY)
  const [toast, setToast] = useState<string | null>(null)
  const storyRef = useRef<Story | null>(null)

  const theme = useMemo(() => getTheme(pack?.theme ?? 'base'), [pack])
  const palette = useMemo(() => themePalette(theme), [theme])
  const themeStyle = useMemo(
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

  const startPack = (next: Pack | null) => {
    if (!next) {
      setToast('That pack is no longer installed.')
      return
    }
    const story = new Story(next.stories[0].json)
    storyRef.current = story
    const saved = loadProgress(next.id)
    if (saved) {
      try {
        story.state.LoadJson(saved.state)
        setTurns(saved.turns ?? [])
        setPlay(readTurn(story))
        setPack(next)
        return
      } catch {
        clearProgress(next.id)
      }
    }
    const first = readTurn(story)
    setTurns(first.text ? [first.text] : [])
    setPlay(first)
    setPack(next)
  }

  const handleChoose = (index: number) => {
    if (!pack) return
    const story = storyRef.current
    if (!story) return
    const next = choose(story, index)
    const nextTurns = next.text ? [...turns, next.text] : turns
    setTurns(nextTurns)
    setPlay(next)
    saveProgress(pack.id, { state: story.state.ToJson(), turns: nextTurns })
  }

  const handleRestart = () => {
    if (!pack) return
    clearProgress(pack.id)
    const story = new Story(pack.stories[0].json)
    storyRef.current = story
    const first = readTurn(story)
    setTurns(first.text ? [first.text] : [])
    setPlay(first)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { pack: imported, error } = parsePack(await file.text())
    if (!imported) {
      setToast(error ?? 'Could not import that pack.')
      return
    }
    try {
      installPack(imported)
      setLibrary(listLibrary())
      setToast(`Installed ${imported.title}`)
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : 'Could not install that pack.',
      )
    }
  }

  const handleRemove = (id: string) => {
    removePack(id)
    setLibrary(listLibrary())
  }

  const backToLibrary = () => {
    setPack(null)
    setLibrary(listLibrary())
  }

  if (!pack) {
    return (
      <div className="player-shell">
        <header className="player-bar">
          <div className="player-brand">
            Pathwright <span>Player</span>
          </div>
          <nav className="player-nav">
            <a href="./">Studio</a>
          </nav>
        </header>
        <main className="library">
          <div className="library-head">
            <h1>Library</h1>
            <label className="import-button">
              Import pack
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImport}
                hidden
              />
            </label>
          </div>
          {library.length === 0 ? (
            <p className="muted">
              No packs installed. Build one in the Studio, then import the JSON
              here.
            </p>
          ) : (
            <ul className="pack-grid">
              {library.map((entry) => {
                const entryTheme = getTheme(entry.theme)
                return (
                  <li
                    key={entry.id}
                    className="pack-card"
                    style={{ borderColor: entryTheme.accent }}
                  >
                    <div className="pack-theme">{entryTheme.title}</div>
                    <h2>{entry.title}</h2>
                    <p className="muted">{entry.author || 'Unknown author'}</p>
                    <div className="pack-actions">
                      <button
                        type="button"
                        onClick={() => startPack(loadPack(entry.id))}
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => handleRemove(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </main>
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  return (
    <div className="player-shell" style={themeStyle}>
      <header className="player-bar">
        <button type="button" className="ghost" onClick={backToLibrary}>
          ← Library
        </button>
        <div className="player-title">{pack.title}</div>
        <span className="theme-chip">{theme.title}</span>
      </header>
      <main className="reader">
        <div className="reader-text">
          {turns.map((turn, turnIndex) =>
            turn.split(/\n{2,}/).map((paragraph, index) => (
              <p key={`${turnIndex}-${index}`}>{paragraph}</p>
            )),
          )}
        </div>
        <div className="reader-choices">
          {play.choices.map((choice) => (
            <button
              key={choice.index}
              type="button"
              className="choice"
              onClick={() => handleChoose(choice.index)}
            >
              <span className="num">{choice.index + 1}</span>
              {choice.text}
            </button>
          ))}
          {play.ended && <div className="end">The End</div>}
        </div>
        <div className="reader-bar">
          <button type="button" onClick={handleRestart}>
            Restart
          </button>
        </div>
      </main>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
