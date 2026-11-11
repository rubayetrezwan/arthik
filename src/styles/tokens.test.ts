/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEME_COLORS } from '../state/theme'

// WCAG AA for every pair of colour tokens the app puts together, in both themes: 4.5:1 for
// text, 3:1 for the edges of controls and for the marks of charts and bars (WCAG 1.4.11).
// Read from disk: the test runner turns a stylesheet import into an object, not its text.
const tokensCss = readFileSync(join(__dirname, 'tokens.css'), 'utf8')

/** The custom properties set in the first rule whose selector is exactly `selector`. */
function block(selector: string, from = 0): Record<string, string> {
  const start = tokensCss.indexOf(`${selector} {`, from)
  if (start < 0) throw new Error(`tokens.css has no "${selector}" rule`)
  const body = tokensCss.slice(start, tokensCss.indexOf('}', start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(([, name, value]) => [
      name!,
      value!.toLowerCase(),
    ]),
  )
}

const light = block(':root')
const THEMES = { light, dark: { ...light, ...block(':root[data-theme="dark"]') } }

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const PAPERS = ['bg', 'surface']
const TEXT_ON_PAPER = ['ink', 'ink-2', 'primary', 'red', 'vulnerable', 'coping', 'healthy']

/** [foreground, background, minimum ratio, where it is used] */
const PAIRS: [string, string, number, string][] = [
  ...TEXT_ON_PAPER.flatMap((fg) =>
    PAPERS.map((bg): [string, string, number, string] => [
      fg,
      bg,
      4.5,
      'text, links, band words, error messages, the disclaimer, the footer, the wordmark',
    ]),
  ),
  ['primary-ink', 'primary', 4.5, 'primary buttons'],
  ['primary-ink', 'ink', 4.5, 'primary buttons on hover'],
  ['surface', 'ink', 4.5, 'the chosen sample person, the skip link'],
  ['ink', 'zone-c', 4.5, 'selected text (::selection)'],
  ['control', 'bg', 3, 'borders of inputs, selects and buttons'],
  ['control', 'surface', 3, 'borders of inputs, selects and buttons'],
  ['primary', 'bg', 3, 'the focus ring'],
  ['primary', 'surface', 3, 'the focus ring'],
  ['surface', 'ink', 3, 'the focus ring on the chosen sample person'],
  ['ink', 'surface', 3, 'chart bars, income outlines, the striped "want" pattern, double rules'],
  ['ink', 'bg', 3, 'chart bars, income outlines, the striped "want" pattern, double rules'],
  ['ink', 'zone-v', 3, 'score bar fills and the band ticks on the Vulnerable zone'],
  ['ink', 'zone-c', 3, 'score bar fills and the band ticks on the Coping zone'],
  ['ink', 'zone-h', 3, 'score bar fills and the band ticks on the Healthy zone'],
  ['red', 'surface', 3, 'the red border of a field with a problem'],
]

describe.each(Object.entries(THEMES))('the %s theme', (_, tokens) => {
  it('defines every token the pairs use', () => {
    for (const [fg, bg] of PAIRS) {
      expect(tokens[fg], fg).toMatch(/^#/)
      expect(tokens[bg], bg).toMatch(/^#/)
    }
  })

  it.each(PAIRS)('%s on %s is at least %s:1 (%s)', (fg, bg, minimum) => {
    expect(contrast(tokens[fg]!, tokens[bg]!)).toBeGreaterThanOrEqual(minimum)
  })
})

describe('printing', () => {
  it('always uses the light colours, whatever the theme on screen', () => {
    expect(block(':root[data-theme="dark"]', tokensCss.indexOf('@media print'))).toEqual(light)
  })
})

describe('the dark theme', () => {
  it('is warm dark paper, not black and not blue-grey', () => {
    const bg = THEMES.dark.bg!
    const [r, , b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16))
    expect(bg).not.toBe('#000000')
    expect(r!).toBeGreaterThan(b!)
  })

  it('matches the browser bar colour of the theme script and theme.ts', () => {
    expect(THEME_COLORS.dark.toLowerCase()).toBe(THEMES.dark.bg)
    expect(THEME_COLORS.light.toLowerCase()).toBe(THEMES.light.bg)
  })
})
