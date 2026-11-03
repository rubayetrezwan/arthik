// Loads the web fonts a language needs, and only those (spec 9a, "Type, per script").
//
// The fonts are self-hosted through @fontsource, so the browser never contacts Google.
// Each set is a dynamic import, which the build turns into its own chunk, fetched when a
// language that needs it is first shown. This file only loads fonts: the font-family
// rules that use them live in the stylesheets.
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
  // Tiro Bangla for display, Noto Sans Bengali for body. The Latin fonts have no ৳, so
  // English, Spanish and French load this set too.
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

const FONTS_FOR: Record<LocaleCode, (keyof typeof FONT_SETS)[]> = {
  en: ['latin', 'bengali'],
  es: ['latin', 'bengali'],
  fr: ['latin', 'bengali'],
  bn: ['bengali'],
  hi: ['devanagari'],
  ar: ['arabic'],
  zh: ['chinese'],
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

/** Loads the fonts for a language once. The promise never rejects. */
export function loadFonts(l: LocaleCode): Promise<void> {
  let request = requests.get(l)
  if (!request) {
    request = fetchFonts(l)
    requests.set(l, request)
  }
  return request
}
