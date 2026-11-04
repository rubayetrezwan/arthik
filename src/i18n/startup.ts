// Gets the visitor's language ready before React draws anything (no English flash, and no
// jump from left-to-right to right-to-left, for a returning visitor).

import { readStoredLocale } from '../state/prefs'
import { loadFonts } from './fonts'
import type { PreloadedLanguage } from './I18nProvider'
import { loadMessages } from './loadMessages'
import { LOCALES } from './locales'

/**
 * Past this, a visitor on a stalled connection sees the page in English, which is bundled,
 * rather than a blank page. Their language still replaces it once it arrives.
 */
const WAIT_AT_MOST_MS = 5000

/**
 * Sets `<html lang dir>` for the remembered language and loads its messages and font
 * stylesheets, then resolves with the messages to hand to `I18nProvider`.
 *
 * English resolves at once with nothing: its messages are bundled, and its fonts are only
 * started here, so the default path never waits.
 */
export async function prepareFirstPaint({
  waitAtMostMs = WAIT_AT_MOST_MS,
}: { waitAtMostMs?: number } = {}): Promise<PreloadedLanguage | undefined> {
  const locale = readStoredLocale()
  if (locale === 'en') {
    void loadFonts('en')
    return undefined
  }

  const page = document.documentElement
  page.lang = LOCALES[locale].intl
  page.dir = LOCALES[locale].dir

  let timer: number | undefined
  const tooSlow = new Promise<undefined>((resolve) => {
    timer = window.setTimeout(resolve, waitAtMostMs)
  })
  // Neither load rejects: a missing translation or font falls back, it does not fail.
  const ready = Promise.all([loadMessages(locale), loadFonts(locale)]).then(
    ([messages]): PreloadedLanguage => ({ locale, messages }),
  )

  const preloaded = await Promise.race([ready, tooSlow])
  window.clearTimeout(timer)
  if (!preloaded) {
    // The page draws in English for now, so it must read left to right as English.
    page.lang = LOCALES.en.intl
    page.dir = LOCALES.en.dir
  }
  return preloaded
}
