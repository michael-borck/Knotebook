import { useEffect, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

type Status = 'available' | 'downloading' | 'installing' | 'error'

export default function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [status, setStatus] = useState<Status>('available')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const checked = useRef(false)

  useEffect(() => {
    if (!isTauri() || checked.current) return
    checked.current = true
    let cancelled = false
    void (async () => {
      try {
        const next = await check({ timeout: 10_000 })
        if (!cancelled && next) {
          setUpdate(next)
          setStatus('available')
        }
      } catch {
        // Offline or no updater endpoint; stay quiet on startup.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!update) return null

  const dismiss = () => {
    void update.close()
    setUpdate(null)
  }

  const install = async () => {
    setStatus('downloading')
    setError(null)
    setProgress(0)
    try {
      let total = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          setProgress(0)
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          setProgress(total > 0 ? Math.min(1, downloaded / total) : null)
        } else {
          setStatus('installing')
          setProgress(1)
        }
      })
      await relaunch()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Update failed.')
    }
  }

  const busy = status === 'downloading' || status === 'installing'

  return (
    <div className="update-banner" role="status" aria-live="polite">
      <div className="update-copy">
        <strong>Knotebook {update.version} is available</strong>
        <span>
          {status === 'downloading'
            ? progress == null
              ? 'Downloading…'
              : `Downloading ${Math.round(progress * 100)}%`
            : status === 'installing'
              ? 'Installing…'
              : status === 'error'
                ? (error ?? 'Update failed.')
                : `You are on ${update.currentVersion}.`}
        </span>
        {status === 'downloading' && (
          <progress value={progress ?? 0} max={1} />
        )}
      </div>
      <div className="update-actions">
        <button type="button" onClick={() => void install()} disabled={busy}>
          Install & restart
        </button>
        <button
          type="button"
          className="ghost"
          onClick={dismiss}
          disabled={busy}
        >
          Later
        </button>
      </div>
    </div>
  )
}
