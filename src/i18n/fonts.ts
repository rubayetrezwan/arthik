// Loads the web fonts a language needs, and only those (spec 9a, "Type, per script").
//
// The fonts are self-hosted through @fontsource, so the browser never contacts Google.
// Each import is a stylesheet of @font-face rules. The build keeps every one as its own
// CSS file, outside the main bundle, and the dynamic import adds it to the page when a
// language that needs it is first shown. The font files inside are fetched later, by the
// browser, only when text uses them. This file only loads stylesheets: the font-family
// rules that use the fonts live in the app's own CSS.
//
// Only the weights the design uses are loaded: 400, 500 and 600, plus Newsreader italic.
// Tiro Bangla and Tiro Devanagari Hindi are published in 400 alone.

import type { LocaleCode } from './locales'

const FONT_SETS = {
  // Newsreader for display and figures, IBM Plex Sans for body.
  latin: () =>
    Promise.all([
      import('@fontsource/newsreader/400.css'),
      import('@fontsource/newsreader/500.css'),
      import('@fontsource/newsreader/600.css'),
      import('@fontsource/newsreader/400-italic.css'),
      import('@fontsource/ibm-plex-sans/400.css'),
      import('@fontsource/ibm-plex-sans/500.css'),
      import('@fontsource/ibm-plex-sans/600.css'),
    ]),
  // Tiro Bangla for display, Noto Sans Bengali for body. Every language loads it (below).
  bengali: () =>
    Promise.all([
      import('@fontsource/tiro-bangla/400.css'),
      import('@fontsource/noto-sans-bengali/400.css'),
      import('@fontsource/noto-sans-bengali/500.css'),
      import('@fontsource/noto-sans-bengali/600.css'),
    ]),
  devanagari: () =>
    Promise.all([
      import('@fontsource/tiro-devanagari-hindi/400.css'),
      import('@fontsource/ibm-plex-sans-devanagari/400.css'),
      import('@fontsource/ibm-plex-sans-devanagari/500.css'),
      import('@fontsource/ibm-plex-sans-devanagari/600.css'),
    ]),
  arabic: () =>
    Promise.all([
      import('@fontsource/noto-naskh-arabic/400.css'),
      import('@fontsource/noto-naskh-arabic/500.css'),
      import('@fontsource/noto-naskh-arabic/600.css'),
      import('@fontsource/ibm-plex-sans-arabic/400.css'),
      import('@fontsource/ibm-plex-sans-arabic/500.css'),
      import('@fontsource/ibm-plex-sans-arabic/600.css'),
    ]),
  // The wordmark's "Arthik" is set in Newsreader 600 in every language.
  wordmark: () => import('@fontsource/newsreader/600.css'),
  chinese: () =>
    Promise.all([
      import('@fontsource/noto-serif-sc/400.css'),
      import('@fontsource/noto-serif-sc/500.css'),
      import('@fontsource/noto-serif-sc/600.css'),
      import('@fontsource/noto-sans-sc/400.css'),
      import('@fontsource/noto-sans-sc/500.css'),
      import('@fontsource/noto-sans-sc/600.css'),
    ]),
}

// Every language shows the wordmark, "Arthik" in Newsreader beside "আর্থিক" in Tiro Bangla,
// and amounts in taka, whose ৳ only the Bengali fonts have. So every language declares the
// Bengali set and the wordmark weight too. Their files download only for the glyphs on screen.
const FONTS_FOR: Record<LocaleCode, (keyof typeof FONT_SETS)[]> = {
  en: ['latin', 'bengali'],
  es: ['latin', 'bengali'],
  fr: ['latin', 'bengali'],
  bn: ['bengali', 'wordmark'],
  hi: ['devanagari', 'bengali', 'wordmark'],
  ar: ['arabic', 'bengali', 'wordmark'],
  zh: ['chinese', 'bengali', 'wordmark'],
}

const requests = new Map<LocaleCode, Promise<void>>()

async function fetchFonts(l: LocaleCode): Promise<void> {
  try {
    await Promise.all(FONTS_FOR[l].map((set) => FONT_SETS[set]()))
  } catch {
    // The page works with the browser's fallback fonts, so a font that fails to load
    // must not break the app. Nothing is logged: there is nothing a visitor can do.
  }
}

/**
 * Loads the font stylesheets for a language, once. The promise resolves when the CSS is in,
 * not when the font files have downloaded, and it never rejects.
 */
export function loadFonts(l: LocaleCode): Promise<void> {
  let request = requests.get(l)
  if (!request) {
    request = fetchFonts(l)
    requests.set(l, request)
  }
  return request
}
