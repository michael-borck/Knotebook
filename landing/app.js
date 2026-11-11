const RELEASE_API =
  'https://api.github.com/repos/michael-borck/Knotebook/releases/latest'
const RELEASE_PAGE =
  'https://github.com/michael-borck/Knotebook/releases/latest'
const CACHE_KEY = 'knotebook.latestRelease'

function pick(assets, test) {
  return assets.find((asset) => test(asset.name)) || null
}

function detectPlatform() {
  const ua = navigator.userAgent || ''
  const p =
    (navigator.userAgentData && navigator.userAgentData.platform) ||
    navigator.platform ||
    ''
  const iPad = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPad) {
    return { os: 'mobile', arch: null }
  }
  if (/Mac/i.test(p) || /Macintosh/i.test(ua)) {
    return { os: 'mac', arch: 'arm64' }
  }
  if (/Win/i.test(p) || /Windows/i.test(ua)) {
    return { os: 'windows', arch: 'x64' }
  }
  if (/Linux/i.test(p) || /Linux/i.test(ua)) {
    return { os: 'linux', arch: 'x64' }
  }
  return { os: 'unknown', arch: null }
}

async function detectMacArch(platform) {
  if (platform.os !== 'mac') return
  try {
    const data = navigator.userAgentData
    if (!data || !data.getHighEntropyValues) return
    const values = await data.getHighEntropyValues(['architecture'])
    if (values.architecture === 'x86') platform.arch = 'x64'
    else if (values.architecture === 'arm') platform.arch = 'arm64'
  } catch {
    // Default to Apple silicon; the Intel link is always available.
  }
}

function setLink(id, asset) {
  const element = document.getElementById(id)
  if (!element) return
  element.href = asset ? asset.url : RELEASE_PAGE
}

async function loadRelease() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) return JSON.parse(cached)
  } catch {
    // Ignore storage failures.
  }

  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!response.ok) return null
    const data = await response.json()
    const release = {
      tag: data.tag_name,
      assets: (data.assets || []).map((asset) => ({
        name: asset.name,
        url: asset.browser_download_url,
      })),
    }
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(release))
    } catch {
      // Ignore storage failures.
    }
    return release
  } catch {
    return null
  }
}

async function main() {
  const platform = detectPlatform()
  await detectMacArch(platform)
  const release = await loadRelease()
  const assets = release ? release.assets : []

  const macArm = pick(
    assets,
    (name) => name.endsWith('.dmg') && /aarch64/i.test(name),
  )
  const macX64 = pick(
    assets,
    (name) => name.endsWith('.dmg') && /x64/i.test(name),
  )
  const winExe = pick(assets, (name) => /_x64-setup\.exe$/i.test(name))
  const winMsi = pick(assets, (name) => /_x64_en-US\.msi$/i.test(name))
  const appImage = pick(assets, (name) => /_amd64\.AppImage$/i.test(name))
  const deb = pick(assets, (name) => /_amd64\.deb$/i.test(name))

  setLink('dl-mac-arm', macArm)
  setLink('dl-mac-x64', macX64)
  setLink('dl-win-exe', winExe)
  setLink('dl-win-msi', winMsi)
  setLink('dl-linux-appimage', appImage)
  setLink('dl-linux-deb', deb)

  const version = document.getElementById('release-version')
  if (version) version.textContent = release ? release.tag : 'unavailable'

  const primary = document.getElementById('primary-download')
  const primaryLabel = document.getElementById('primary-download-label')
  const primaryMeta = document.getElementById('primary-download-meta')
  if (!primary || !primaryLabel || !primaryMeta) return

  let asset = null
  let label = 'Download Knotebook'
  let meta = 'Choose your platform'

  if (platform.os === 'mac') {
    const arm = platform.arch !== 'x64'
    asset = arm ? macArm : macX64
    label = 'Download for macOS'
    meta = arm ? 'Apple silicon · DMG' : 'Intel · DMG'
  } else if (platform.os === 'windows') {
    asset = winExe
    label = 'Download for Windows'
    meta = 'Installer · EXE'
  } else if (platform.os === 'linux') {
    asset = appImage
    label = 'Download for Linux'
    meta = 'AppImage'
  } else if (platform.os === 'mobile') {
    label = 'Desktop downloads'
    meta = 'macOS · Windows · Linux'
  }

  primary.href = asset ? asset.url : RELEASE_PAGE
  primaryLabel.textContent = label
  primaryMeta.textContent = meta
}

main()
