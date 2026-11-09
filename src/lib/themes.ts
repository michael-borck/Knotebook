export interface Theme {
  id: string
  title: string
  hint: string
  accent: string
  bg: string
  artRoot: string
}

export interface ThemePalette {
  bg: string
  panel: string
  panel2: string
  text: string
  muted: string
  border: string
  accent: string
}

type RawTheme = [id: string, title: string, hint: string, accent: string, bg: string]

const RAW: RawTheme[] = [
  ['base', 'Classic', 'neutral, timeless, versatile', '#c084fc', '#101117'],
  ['aviation', 'Aviation', 'cockpits, runways, altitude', '#7fb3d5', '#0d1117'],
  ['business', 'Business', 'boardrooms, leverage, reputation', '#c9a86a', '#111013'],
  ['cybersecurity', 'Cybersecurity', 'hackers, intrusion, trust', '#22d3ee', '#0b1116'],
  ['egypt', 'Ancient Egypt', 'sand, dynasties, old gods', '#e0b23c', '#141008'],
  ['gothic', 'Gothic Horror', 'manors, fog, things in the walls', '#b06ab3', '#0f0c12'],
  ['kingdom', 'Medieval Kingdom', 'crowns, keeps, old magic', '#e0b63c', '#121017'],
  ['medical', 'Medical', 'triage, diagnosis, pressure', '#5eead4', '#0b1214'],
  ['military', 'Military', 'orders, terrain, cost', '#84cc16', '#0e120b'],
  ['mythology', 'Mythology', 'gods, oaths, consequence', '#f59e0b', '#140f0a'],
  ['nautical', 'Nautical', 'decks, storms, the deep', '#38bdf8', '#0b1117'],
  ['noir', 'Noir', 'rain-slick streets, moral fog', '#d6a354', '#0e0f13'],
  ['pirate', 'Pirate', 'sails, plunder, mutiny', '#f97316', '#12100c'],
  ['postapoc', 'Post-apocalyptic', 'ruins, scarcity, salvage', '#a3a380', '#11110e'],
  ['prehistoric', 'Prehistoric', 'fire, beasts, first tools', '#d97706', '#140f0b'],
  ['samurai', 'Samurai', 'honour, blades, duty', '#ef4444', '#120d0e'],
  ['science', 'Science', 'labs, evidence, discovery', '#60a5fa', '#0c1017'],
  ['sport', 'Sport', 'training, rivalry, the whistle', '#22c55e', '#0d1210'],
  ['steampunk', 'Steampunk', 'brass, steam, invention', '#b45309', '#130f0b'],
  ['underwater', 'Underwater', 'pressure, currents, the light above', '#06b6d4', '#081318'],
  ['university', 'University', 'halls, deadlines, ideas', '#8b5cf6', '#100f16'],
  ['viking', 'Viking', 'longships, frost, saga', '#64748b', '#0d1013'],
  ['western', 'Western', 'dust, sheriffs, the long ride', '#d4a373', '#14110d'],
  ['cyberpunk', 'Cyberpunk', 'neon megacities, implants, dystopia', '#ff52e1', '#0b0b12'],
  ['space', 'Space Opera', 'starships, empires, precursors', '#a78bfa', '#0a0d18'],
]

export const THEMES: Theme[] = RAW.map(([id, title, hint, accent, bg]) => ({
  id,
  title,
  hint,
  accent,
  bg,
  artRoot: `https://store.swipeverse.app/art/${id}`,
}))

export const DEFAULT_THEME_ID = 'base'

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

export function themePalette(theme: Theme): ThemePalette {
  return {
    bg: theme.bg,
    panel: mix(theme.bg, '#ffffff', 0.05),
    panel2: mix(theme.bg, '#ffffff', 0.09),
    text: '#e8e6ef',
    muted: mix(theme.bg, '#e8e6ef', 0.55),
    border: mix(theme.bg, '#ffffff', 0.16),
    accent: theme.accent,
  }
}

function mix(hex: string, target: string, amount: number): string {
  const a = parseHex(hex)
  const b = parseHex(target)
  if (!a || !b) return hex
  const channels = a.map((value, index) =>
    Math.round(value + (b[index] - value) * amount),
  )
  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!match) return null
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
