import { invoke, isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

export interface OpenedFile {
  path: string
  text: string
}

export function runningInTauri(): boolean {
  return isTauri()
}

export async function openInkFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Ink', extensions: ['ink', 'txt'] }],
    })
    if (!selected || typeof selected !== 'string') return null
    const text = await invoke<string>('read_text_file', { path: selected })
    return { path: selected, text }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.ink,.txt,text/plain'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      resolve({ path: file.name, text: await file.text() })
    }
    input.click()
  })
}

export async function saveInkFile(
  path: string | null,
  text: string,
): Promise<string | null> {
  if (isTauri()) {
    const target = await save({
      defaultPath: path ?? 'story.ink',
      filters: [{ name: 'Ink', extensions: ['ink'] }],
    })
    if (!target) return null
    await invoke('write_text_file', { path: target, contents: text })
    return target
  }

  const filename = path ?? 'story.ink'
  download(filename, new Blob([text], { type: 'text/plain' }))
  return filename
}

export async function saveHtmlFile(
  name: string,
  html: string,
): Promise<string | null> {
  const base =
    name
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'story'
  const filename = base.endsWith('.html') ? base : `${base}.html`

  if (isTauri()) {
    const target = await save({
      defaultPath: filename,
      filters: [{ name: 'HTML', extensions: ['html'] }],
    })
    if (!target) return null
    await invoke('write_text_file', { path: target, contents: html })
    return target
  }

  download(filename, new Blob([html], { type: 'text/html' }))
  return filename
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
