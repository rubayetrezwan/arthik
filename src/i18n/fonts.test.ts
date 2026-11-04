import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LocaleCode } from './locales'

// Two files from each font set: the display face and the body face. The wordmark set is
// Newsreader's 600 alone, which the Latin set also loads.
const FONT_FILES = {
  latin: ['@fontsource/newsreader/400.css', '@fontsource/ibm-plex-sans/400.css'],
  bengali: ['@fontsource/tiro-bangla/400.css', '@fontsource/noto-sans-bengali/400.css'],
  devanagari: [
    '@fontsource/tiro-devanagari-hindi/400.css',
    '@fontsource/ibm-plex-sans-devanagari/400.css',
  ],
  arabic: ['@fontsource/noto-naskh-arabic/400.css', '@fontsource/ibm-plex-sans-arabic/400.css'],
  chinese: ['@fontsource/noto-serif-sc/400.css', '@fontsource/noto-sans-sc/400.css'],
  wordmark: ['@fontsource/newsreader/600.css'],
}

type FontSet = keyof typeof FONT_FILES

/** Replaces every font file with a stub that notes which set it belongs to. */
function recordImports() {
  const imported = new Set<FontSet>()
  for (const [set, files] of Object.entries(FONT_FILES)) {
    for (const file of files) {
      vi.doMock(file, () => {
        imported.add(set as FontSet)
        return {}
      })
    }
  }
  return imported
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  for (const files of Object.values(FONT_FILES)) {
    for (const file of files) vi.doUnmock(file)
  }
})

describe('loadFonts', () => {
  // Every language shows the wordmark ("Arthik" in Newsreader beside "আর্থিক" in Tiro
  // Bangla) and taka amounts, whose ৳ only the Bengali fonts have.
  it.each<[LocaleCode, FontSet[]]>([
    ['en', ['latin', 'bengali', 'wordmark']],
    ['es', ['latin', 'bengali', 'wordmark']],
    ['fr', ['latin', 'bengali', 'wordmark']],
    ['bn', ['bengali', 'wordmark']],
    ['hi', ['devanagari', 'bengali', 'wordmark']],
    ['ar', ['arabic', 'bengali', 'wordmark']],
    ['zh', ['chinese', 'bengali', 'wordmark']],
  ])('loads only the fonts %s needs', async (l, expected) => {
    const imported = recordImports()
    const { loadFonts } = await import('./fonts')

    await loadFonts(l)

    expect([...imported].sort()).toEqual([...expected].sort())
  })

  it('does not load a language twice', async () => {
    const { loadFonts } = await import('./fonts')

    const first = loadFonts('ar')
    const second = loadFonts('ar')

    expect(second).toBe(first)
    await first
    expect(loadFonts('ar')).toBe(first)
  })

  it('does not reject when a font file cannot be loaded', async () => {
    vi.doMock('@fontsource/noto-sans-sc/400.css', () => {
      throw new Error('network down')
    })
    const { loadFonts } = await import('./fonts')

    await expect(loadFonts('zh')).resolves.toBeUndefined()
  })
})
