import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react'
import { Story } from 'inkjs/full'
import { choose, readTurn } from './lib/ink'
import { getTheme, themePalette } from './lib/themes'
import { parsePack, type Pack } from './lib/pack'
import {
  fetchPackBytes,
  parseCatalogue,
  sha256Hex,
  type Catalogue,
  type CatalogueEntry,
} from './lib/catalogue'
import { firstImageTag } from './lib/tags'
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

type View = 'library' | 'store'

export default function Player() {
  const [library, setLibrary] = useState<LibraryEntry[]>([])
  const [view, setView] = useState<View>('library')
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [catalogueError, setCatalogueError] = useState<string | null>(null)
  const [catalogueLoading, setCatalogueLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [pack, setPack] = useState<Pack | null>(null)
  const [turns, setTurns] = useState<string[]>([])
  const [play, setPlay] = useState<PlayView>(EMPTY_PLAY)
  const [savedImage, setSavedImage] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const storyRef = useRef<Story | null>(null)

  const catalogueUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return (
      params.get('store') ??
      (import.meta.env.VITE_CATALOGUE_URL as string | undefined) ??
      'catalogue.json'
    )
  }, [])

  useEffect(() => {
    let active = true
    listLibrary()
      .then((entries) => {
        if (active) setLibrary(entries)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

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

  const imageValue = useMemo(
    () => firstImageTag(play.tags) ?? savedImage,
    [play.tags, savedImage],
  )
  const imageUrl = useMemo(
    () => (pack ? resolvePackAsset(pack, imageValue) : undefined),
    [pack, imageValue],
  )

  const startPack = async (id: string) => {
    const next = await loadPack(id)
    if (!next) {
      setToast('That pack is no longer installed.')
      return
    }
    const story = new Story(next.stories[0].json)
    storyRef.current = story
    const saved = await loadProgress(next.id)
    if (saved) {
      try {
        story.state.LoadJson(saved.state)
        setTurns(saved.turns ?? [])
        setSavedImage(saved.image ?? null)
        setPlay(readTurn(story))
        setPack(next)
        return
      } catch {
        await clearProgress(next.id)
      }
    }
    const first = readTurn(story)
    setTurns(first.text ? [first.text] : [])
    setSavedImage(null)
    setPlay(first)
    setPack(next)
  }

  const handleChoose = (index: number) => {
    if (!pack) return
    const story = storyRef.current
    if (!story) return
    const next = choose(story, index)
    const nextTurns = next.text ? [...turns, next.text] : turns
    const nextImage = firstImageTag(next.tags) ?? savedImage
    setTurns(nextTurns)
    setSavedImage(nextImage)
    setPlay(next)
    void saveProgress(pack.id, {
      state: story.state.ToJson(),
      turns: nextTurns,
      image: nextImage ?? undefined,
    })
  }

  const handleRestart = () => {
    if (!pack) return
    void clearProgress(pack.id)
    const story = new Story(pack.stories[0].json)
    storyRef.current = story
    const first = readTurn(story)
    setTurns(first.text ? [first.text] : [])
    setSavedImage(null)
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
      await installPack(imported)
      setLibrary(await listLibrary())
      setToast(`Installed ${imported.title}`)
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : 'Could not install that pack.',
      )
    }
  }

  const handleRemove = async (id: string) => {
    await removePack(id)
    setLibrary(await listLibrary())
  }

  const openStore = async () => {
    setView('store')
    setCatalogueLoading(true)
    setCatalogueError(null)
    try {
      const base = new URL(catalogueUrl, window.location.href).toString()
      const response = await fetch(base, { cache: 'no-cache' })
      if (!response.ok) {
        throw new Error(`Catalogue not found (${response.status}).`)
      }
      const { catalogue: parsed, error } = parseCatalogue(await response.text())
      if (!parsed) throw new Error(error ?? 'Invalid catalogue.')
      setCatalogue(parsed)
    } catch (error) {
      setCatalogue(null)
      setCatalogueError(
        error instanceof Error ? error.message : 'Could not load the store.',
      )
    } finally {
      setCatalogueLoading(false)
    }
  }

  const installFromStore = async (entry: CatalogueEntry) => {
    setInstalling(entry.id)
    try {
      const base = new URL(catalogueUrl, window.location.href).toString()
      const bytes = await fetchPackBytes(entry, base)
      const digest = await sha256Hex(bytes)
      if (digest.toLowerCase() !== entry.sha256.toLowerCase()) {
        throw new Error('Hash mismatch — the pack was rejected.')
      }
      const { pack: imported, error } = parsePack(
        new TextDecoder().decode(bytes),
      )
      if (!imported) throw new Error(error ?? 'Invalid pack.')
      await installPack(imported)
      setLibrary(await listLibrary())
      setToast(`Installed ${imported.title}`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Install failed.')
    } finally {
      setInstalling(null)
    }
  }

  const backToLibrary = () => {
    setPack(null)
    setView('library')
    void listLibrary().then(setLibrary)
  }

  if (pack) {
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
          {imageUrl && <img className="scene-image" src={imageUrl} alt="" />}
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

  return (
    <div className="player-shell">
      <header className="player-bar">
        <div className="player-brand">
          Pathwright <span>Player</span>
        </div>
        <nav className="player-nav">
          <button
            type="button"
            className={view === 'library' ? 'active' : ''}
            onClick={() => setView('library')}
          >
            Library
          </button>
          <button
            type="button"
            className={view === 'store' ? 'active' : ''}
            onClick={() => void openStore()}
          >
            Store
          </button>
          <a href="./">Studio</a>
        </nav>
      </header>

      {view === 'library' ? (
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
              No packs installed. Import a pack or open the Store.
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
                    {entry.cover && (
                      <img className="pack-cover" src={entry.cover} alt="" />
                    )}
                    <div className="pack-theme">{entryTheme.title}</div>
                    <h2>{entry.title}</h2>
                    <p className="muted">{entry.author || 'Unknown author'}</p>
                    <div className="pack-actions">
                      <button
                        type="button"
                        onClick={() => void startPack(entry.id)}
                      >
                        Play
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void handleRemove(entry.id)}
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
      ) : (
        <main className="library">
          <div className="library-head">
            <h1>Store</h1>
            <button
              type="button"
              className="mini"
              onClick={() => void openStore()}
            >
              Refresh
            </button>
          </div>
          {catalogueLoading && <p className="muted">Loading catalogue…</p>}
          {catalogueError && (
            <div className="store-error">
              <p>{catalogueError}</p>
              <p className="muted">
                Set <code>VITE_CATALOGUE_URL</code> or add{' '}
                <code>?store=&lt;url&gt;</code>.
              </p>
            </div>
          )}
          {catalogue && catalogue.packs.length > 0 && (
            <ul className="pack-grid">
              {catalogue.packs.map((entry) => {
                const installed = library.some((item) => item.id === entry.id)
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
                    {entry.description && (
                      <p className="muted">{entry.description}</p>
                    )}
                    <div className="pack-actions">
                      <button
                        type="button"
                        disabled={installing === entry.id}
                        onClick={() => void installFromStore(entry)}
                      >
                        {installing === entry.id
                          ? 'Installing…'
                          : installed
                            ? 'Reinstall'
                            : 'Install'}
                      </button>
                      {installed && <span className="installed">Installed</span>}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {catalogue && catalogue.packs.length === 0 && (
            <p className="muted">The catalogue is empty.</p>
          )}
        </main>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function resolvePackAsset(pack: Pack, value: string | null): string | undefined {
  if (!value || !pack.assets) return undefined
  return pack.assets[value] ?? pack.assets[`assets/${value}`]
}
