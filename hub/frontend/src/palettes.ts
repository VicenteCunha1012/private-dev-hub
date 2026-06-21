import type { PaletteConfig } from './types'

type Vars = Record<string, string>

export const PRESETS: Record<string, { label: string; accent: string; vars: Vars }> = {
  midnight: {
    label: 'Midnight',
    accent: '#a78bfa',
    vars: {
      '--bg': '#0e0c15', '--sidebar-bg': '#100e1a', '--card-bg': '#171425',
      '--card-hover': '#1e1a2e', '--input-bg': '#0e0c15',
      '--border': '#2a2440', '--border-light': '#342e50',
      '--accent': '#a78bfa', '--accent-2': '#818cf8',
      '--accent-glow': 'rgba(167,139,250,0.18)', '--accent-solid': '#7c3aed',
      '--active-bg': 'rgba(167,139,250,0.14)', '--active-text': '#c4b5fd',
    },
  },
  ocean: {
    label: 'Ocean',
    accent: '#38bdf8',
    vars: {
      '--bg': '#0a1220', '--sidebar-bg': '#0c1528', '--card-bg': '#101e34',
      '--card-hover': '#152540', '--input-bg': '#0a1220',
      '--border': '#1c3050', '--border-light': '#253d64',
      '--accent': '#38bdf8', '--accent-2': '#22d3ee',
      '--accent-glow': 'rgba(56,189,248,0.18)', '--accent-solid': '#0284c7',
      '--active-bg': 'rgba(56,189,248,0.14)', '--active-text': '#7dd3fc',
    },
  },
  forest: {
    label: 'Forest',
    accent: '#4ade80',
    vars: {
      '--bg': '#091510', '--sidebar-bg': '#0b1812', '--card-bg': '#0f2018',
      '--card-hover': '#142a20', '--input-bg': '#091510',
      '--border': '#1c3824', '--border-light': '#234a2e',
      '--accent': '#4ade80', '--accent-2': '#34d399',
      '--accent-glow': 'rgba(74,222,128,0.18)', '--accent-solid': '#16a34a',
      '--active-bg': 'rgba(74,222,128,0.14)', '--active-text': '#86efac',
    },
  },
  ember: {
    label: 'Ember',
    accent: '#fb923c',
    vars: {
      '--bg': '#150d06', '--sidebar-bg': '#1a1008', '--card-bg': '#22160c',
      '--card-hover': '#2c1d11', '--input-bg': '#150d06',
      '--border': '#3f2810', '--border-light': '#52341a',
      '--accent': '#fb923c', '--accent-2': '#fbbf24',
      '--accent-glow': 'rgba(251,146,60,0.18)', '--accent-solid': '#ea580c',
      '--active-bg': 'rgba(251,146,60,0.14)', '--active-text': '#fdba74',
    },
  },
  mono: {
    label: 'Mono',
    accent: '#a3a3a3',
    vars: {
      '--bg': '#0d0d0d', '--sidebar-bg': '#111111', '--card-bg': '#1a1a1a',
      '--card-hover': '#222222', '--input-bg': '#0d0d0d',
      '--border': '#2d2d2d', '--border-light': '#3d3d3d',
      '--accent': '#a3a3a3', '--accent-2': '#737373',
      '--accent-glow': 'rgba(163,163,163,0.18)', '--accent-solid': '#525252',
      '--active-bg': 'rgba(163,163,163,0.14)', '--active-text': '#d4d4d4',
    },
  },
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function clamp(v: number): number { return Math.max(0, Math.min(255, Math.round(v))) }

function toHex(r: number, g: number, b: number): string {
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`
}

function buildCustomVars(accent: string, accent2?: string, bgBase?: string): Vars {
  const [ar, ag, ab] = hexToRgb(accent)
  const bg = bgBase ?? toHex(ar * 0.055 + 4, ag * 0.045 + 4, ab * 0.07 + 5)
  const [br, bgG, bb] = hexToRgb(bg)
  const s = (v: number, add: number) => v + add
  const a2 = accent2 ?? toHex(ar * 0.78, ag * 0.88, Math.min(255, ab * 1.06))
  const solid = toHex(ar * 0.72, ag * 0.72, ab * 0.72)
  const activeText = toHex(Math.min(255, ar * 1.18), Math.min(255, ag * 1.18), Math.min(255, ab * 1.18))
  return {
    '--bg': bg,
    '--sidebar-bg': toHex(s(br, 2), s(bgG, 2), s(bb, 5)),
    '--card-bg': toHex(s(br, 7), s(bgG, 6), s(bb, 13)),
    '--card-hover': toHex(s(br, 14), s(bgG, 12), s(bb, 22)),
    '--input-bg': bg,
    '--border': toHex(s(br, 28), s(bgG, 24), s(bb, 44)),
    '--border-light': toHex(s(br, 40), s(bgG, 34), s(bb, 58)),
    '--accent': accent,
    '--accent-2': a2,
    '--accent-glow': `rgba(${ar},${ag},${ab},0.18)`,
    '--accent-solid': solid,
    '--active-bg': `rgba(${ar},${ag},${ab},0.14)`,
    '--active-text': activeText,
  }
}

export function applyPalette(config: PaletteConfig) {
  const vars = config.preset === 'custom' && config.customAccent
    ? buildCustomVars(config.customAccent, config.customAccent2, config.customBg)
    : (PRESETS[config.preset]?.vars ?? PRESETS.midnight.vars)
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}
