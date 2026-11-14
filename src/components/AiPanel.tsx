import { useEffect, useMemo, useRef, useState } from 'react'
import { diffLines } from 'diff'
import type { StoryBible } from '../lib/bible'
import type { Issue } from '../lib/types'
import {
  PROVIDER_DEFAULTS,
  generateInk,
  generateWithRetry,
  loadAiSettings,
  saveAiSettings,
  type AiProvider,
  type AiSettings,
} from '../lib/ai'
import {
  clearSnapshots,
  loadSnapshots,
  saveSnapshot,
  type Snapshot,
} from '../lib/snapshots'
import { replaceKnot } from '../lib/inkSource'

interface AiPanelProps {
  source: string
  bible: StoryBible
  snapshotKey: string
  issues: Issue[]
  knots: string[]
  validate: (source: string) => Issue[]
  onApply: (source: string) => void
}

type Status = 'idle' | 'running' | 'ready' | 'error'

export default function AiPanel({
  source,
  bible,
  snapshotKey,
  issues,
  knots,
  validate,
  onApply,
}: AiPanelProps) {
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings())
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [instruction, setInstruction] = useState('')
  const [scope, setScope] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [retryNote, setRetryNote] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() =>
    loadSnapshots(snapshotKey),
  )
  const [saved, setSaved] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setSnapshots(loadSnapshots(snapshotKey))
    setProposal(null)
    setStatus('idle')
    setError(null)
    setAttempt(0)
    setRetryNote(null)
  }, [snapshotKey])

  useEffect(() => {
    if (scope && !knots.includes(scope)) setScope('')
  }, [knots, scope])

  const diff = useMemo(
    () => (proposal == null ? [] : diffLines(source, proposal)),
    [source, proposal],
  )
  const errors = issues.filter((issue) => issue.severity === 'error')

  const updateSettings = (patch: Partial<AiSettings>) => {
    setSaved(false)
    setSettings((previous) => ({ ...previous, ...patch }))
  }

  const chooseProvider = (provider: AiProvider) => {
    const defaults = PROVIDER_DEFAULTS[provider]
    setSaved(false)
    setSettings((previous) => ({
      ...previous,
      provider,
      baseUrl: defaults.baseUrl,
      model: defaults.model,
    }))
  }

  const saveSettings = () => {
    saveAiSettings(settings)
    setSaved(true)
  }

  const runWith = async (task: string, effectiveScope: string) => {
    if (status === 'running') return
    if (!settings.baseUrl.trim() || !settings.model.trim()) {
      setError('Set a base URL and model in the provider settings.')
      setStatus('error')
      return
    }
    saveAiSettings(settings)
    setSaved(true)
    setStatus('running')
    setError(null)
    setProposal(null)
    setAttempt(0)
    setRetryNote(null)
    const scopedTask = effectiveScope
      ? [
          `Revise ONLY the knot "${effectiveScope}". Return only that knot, including the === ${effectiveScope} === header, in a single ink code block. Do not change other knots.`,
          '',
          task || 'Improve this knot while preserving the story.',
        ].join('\n')
      : task
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await generateWithRetry(source, scopedTask, {
        maxAttempts: 3,
        generate: async (candidate, feedback) => {
          const block = await generateInk({
            settings,
            bible,
            source: candidate,
            instruction: feedback,
            signal: controller.signal,
          })
          if (!effectiveScope) return block
          const merged = replaceKnot(candidate, effectiveScope, block)
          if (!merged) {
            throw new Error(
              `The model's revision did not include the knot "${effectiveScope}".`,
            )
          }
          return merged
        },
        validate,
        onAttempt: (nextAttempt) => {
          setAttempt(nextAttempt)
          setStatus('running')
          setRetryNote(nextAttempt > 1 ? `Attempt ${nextAttempt} of 3` : null)
        },
        signal: controller.signal,
      })
      setProposal(result.source)
      setStatus('ready')
      setRetryNote(
        result.errors.length > 0
          ? `Still ${result.errors.length} error${result.errors.length === 1 ? '' : 's'} after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}.`
          : null,
      )
    } catch (err) {
      if (controller.signal.aborted) {
        setStatus('idle')
        setRetryNote(null)
        return
      }
      setStatus('error')
      setError(err instanceof Error ? err.message : 'AI request failed.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }

  const run = (task: string) => runWith(task, scope)

  const apply = () => {
    if (!proposal) return
    setSnapshots(saveSnapshot(snapshotKey, source, 'Before AI edit'))
    onApply(proposal)
    setProposal(null)
    setStatus('idle')
    setError(null)
    setAttempt(0)
    setRetryNote(null)
  }

  const discard = () => {
    setProposal(null)
    setStatus('idle')
    setError(null)
    setAttempt(0)
    setRetryNote(null)
  }

  const restore = (snapshot: Snapshot) => {
    setSnapshots(saveSnapshot(snapshotKey, source, 'Before restore'))
    onApply(snapshot.source)
    setProposal(null)
    setStatus('idle')
    setError(null)
    setAttempt(0)
    setRetryNote(null)
  }

  const fixErrors = () => {
    const list = errors
      .map(
        (issue) =>
          `${issue.line != null ? `line ${issue.line}: ` : ''}${issue.message}`,
      )
      .join('\n')
    setScope('')
    void runWith(
      `Fix the following errors and return the complete corrected script. Keep everything else stable.\n${list}`,
      '',
    )
  }

  const cancel = () => {
    abortRef.current?.abort()
    setStatus('idle')
  }

  const running = status === 'running'
  const changed = proposal != null && proposal !== source

  return (
    <div className="ai">
      <p className="ai-lede">
        Generate or revise the story with an LLM. The bible and full script are
        sent to your provider; the proposal is shown as a diff before anything is
        applied.
      </p>

      <details
        className="ai-settings"
        open={settingsOpen}
        onToggle={(event) => setSettingsOpen(event.currentTarget.open)}
      >
        <summary>Provider settings</summary>
        <label className="ai-field">
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={(event) =>
              chooseProvider(event.target.value as AiProvider)
            }
          >
            <option value="ollama">Ollama (local)</option>
            <option value="openai">OpenAI-compatible</option>
          </select>
        </label>
        <label className="ai-field">
          <span>Base URL</span>
          <input
            value={settings.baseUrl}
            onChange={(event) => updateSettings({ baseUrl: event.target.value })}
            spellCheck={false}
          />
        </label>
        <label className="ai-field">
          <span>Model</span>
          <input
            value={settings.model}
            onChange={(event) => updateSettings({ model: event.target.value })}
            spellCheck={false}
          />
        </label>
        <label className="ai-field">
          <span>API key</span>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(event) => updateSettings({ apiKey: event.target.value })}
            placeholder={
              settings.provider === 'ollama'
                ? 'not needed for Ollama'
                : 'required'
            }
            autoComplete="off"
          />
        </label>
        <div className="ai-actions">
          <button type="button" className="mini" onClick={saveSettings}>
            Save settings
          </button>
          {saved && <span className="ai-status">Saved</span>}
        </div>
        <p className="ai-note">
          The key is stored locally in this browser profile. Use a limited-scope
          key. Ollama must allow this origin (`OLLAMA_ORIGINS`).
        </p>
      </details>

      <label className="ai-field">
        <span>Scope</span>
        <select
          value={scope}
          onChange={(event) => {
            setScope(event.target.value)
            setProposal(null)
            setStatus('idle')
            setError(null)
            setAttempt(0)
            setRetryNote(null)
          }}
        >
          <option value="">Whole story</option>
          {knots.map((knot) => (
            <option key={knot} value={knot}>
              {knot}
            </option>
          ))}
        </select>
      </label>

      <label className="ai-field">
        <span>Instruction</span>
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={4}
          placeholder={
            scope
              ? `e.g. Tighten the dialogue in ${scope}.`
              : 'e.g. Add a new knot called epilogue and connect the ending to it. Keep the noir tone.'
          }
        />
      </label>

      <div className="ai-actions">
        <button
          type="button"
          className="ai-primary"
          onClick={() => void run(instruction)}
          disabled={running}
        >
          {running ? 'Thinking…' : 'Generate / edit'}
        </button>
        {running && (
          <button type="button" className="ghost" onClick={cancel}>
            Cancel
          </button>
        )}
        {errors.length > 0 && !running && (
          <button type="button" className="ghost" onClick={fixErrors}>
            Fix {errors.length} error
            {errors.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {error && <p className="ai-error">{error}</p>}
      {running && (
        <p className="ai-status">
          Attempt {Math.max(1, attempt)} of 3 — waiting for the model…
        </p>
      )}
      {retryNote && !running && <p className="ai-warning">{retryNote}</p>}

      {proposal && (
        <section className="ai-proposal">
          <div className="ai-proposal-head">
            <strong>Proposed edit</strong>
            <span className="ai-status">
              {scope ? `knot ${scope}` : 'whole story'} ·{' '}
              {changed ? 'Review the diff' : 'No changes'}
            </span>
          </div>
          <div className="ai-diff">
            {diff.map((part, partIndex) =>
              part.value
                .split('\n')
                .filter(
                  (line, index, lines) =>
                    !(index === lines.length - 1 && line === ''),
                )
                .map((line, lineIndex) => (
                  <div
                    key={`${partIndex}-${lineIndex}`}
                    className={
                      part.added
                        ? 'diff-add'
                        : part.removed
                          ? 'diff-del'
                          : 'diff-same'
                    }
                  >
                    <span className="diff-sign">
                      {part.added ? '+' : part.removed ? '-' : ' '}
                    </span>
                    {line || ' '}
                  </div>
                )),
            )}
            {diff.length === 0 && <div className="diff-same">No changes.</div>}
          </div>
          <div className="ai-actions">
            <button
              type="button"
              className="ai-primary"
              onClick={apply}
              disabled={!changed}
            >
              Apply
            </button>
            <button type="button" className="ghost" onClick={discard}>
              Discard
            </button>
          </div>
        </section>
      )}

      {snapshots.length > 0 && (
        <details className="ai-history">
          <summary>History ({snapshots.length})</summary>
          <ul>
            {snapshots.map((snapshot, index) => (
              <li key={`${snapshot.at}-${index}`}>
                <span>
                  {new Date(snapshot.at).toLocaleTimeString()} ·{' '}
                  {snapshot.label}
                </span>
                <button
                  type="button"
                  className="mini"
                  onClick={() => restore(snapshot)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
          <div className="ai-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                clearSnapshots(snapshotKey)
                setSnapshots([])
              }}
            >
              Clear history
            </button>
          </div>
        </details>
      )}
    </div>
  )
}
