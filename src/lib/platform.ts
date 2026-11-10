import { invoke, isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'

export interface OpenedFile {
  path: string
  text: string
}

export function runningInTauri(): boolean {
  return isTauri()
}

export function joinPath(root: string, relative: string): string {
  const cleanRoot = root.replace(/[\\/]+$/, '')
  const cleanRelative = relative.replace(/^[\\/]+/, '')
  return `${cleanRoot}/${cleanRelative}`
}

export async function openProjectFolder(): Promise<string | null> {
  if (!isTauri()) return null
  const selected = await open({ directory: true, multiple: false })
  return typeof selected === 'string' ? selected : null
}

export async function listInkFiles(root: string): Promise<string[]> {
  return invoke<string[]>('list_ink_files', { root })
}

export async function listAssetFiles(root: string): Promise<string[]> {
  return invoke<string[]>('list_asset_files', { root })
}

export async function readAssetDataUrl(path: string): Promise<string> {
  return invoke<string>('read_asset_data_url', { path })
}

export async function copyFile(
  source: string,
  destination: string,
): Promise<void> {
  await invoke('copy_file', { source, destination })
}

export async function pickImageFile(): Promise<string | null> {
  if (!isTauri()) return null
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif'],
      },
    ],
  })
  return typeof selected === 'string' ? selected : null
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path })
}

export async function readOptionalTextFile(path: string): Promise<string | null> {
  return invoke<string | null>('read_optional_text_file', { path })
}

export async function writeTextFile(
  path: string,
  contents: string,
): Promise<void> {
  await invoke('write_text_file', { path, contents })
}

export async function backupAndWrite(
  path: string,
  contents: string,
  backupDir: string,
): Promise<void> {
  await invoke('backup_and_write', { path, contents, backupDir })
}

export async function openInkFile(): Promise<OpenedFile | null> {
  if (isTauri()) {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Ink', extensions: ['ink', 'txt'] }],
    })
    if (!selected || typeof selected !== 'string') return null
    const text = await readTextFile(selected)
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
    await writeTextFile(target, text)
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
    await writeTextFile(target, html)
    return target
  }

  download(filename, new Blob([html], { type: 'text/html' }))
  return filename
}

export async function savePackFile(
  name: string,
  json: string,
): Promise<string | null> {
  const base =
    name
      .replace(/[^\w.-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'story'
  const filename = base.endsWith('.json') ? base : `${base}.pathwright.json`

  if (isTauri()) {
    const target = await save({
      defaultPath: filename,
      filters: [{ name: 'Pathwright pack', extensions: ['json'] }],
    })
    if (!target) return null
    await writeTextFile(target, json)
    return target
  }

  download(filename, new Blob([json], { type: 'application/json' }))
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
