import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import { usePrefs } from '../state/prefs'
import { loadFonts } from './fonts'
import { loadMessages, type Messages } from './loadMessages'
import { LOCALES, type LocaleCode } from './locales'
import en from './messages/en.json'

/** A language whose messages, and fonts, have already loaded. */
export interface PreloadedLanguage {
  locale: LocaleCode
  messages: Messages
}

type Loaded = PreloadedLanguage

/** What stays on screen when the asked-for language cannot be loaded. */
const ENGLISH: Loaded = { locale: 'en', messages: en }

const DisplayedLocaleContext = createContext<LocaleCode | null>(null)

/**
 * The language that is on screen. Use it, not `usePrefs().locale`, to format numbers,
 * money and dates.
 *
 * `usePrefs().locale` is the language the visitor asked for, and it changes at once. The
 * text only changes when the new language has loaded, so for a moment the two differ.
 * Formatting with the requested language would put, say, Arabic number formats next to
 * English text. This one changes together with the text.
 */
export function useLocale(): LocaleCode {
  const locale = useContext(DisplayedLocaleContext)
  if (!locale) throw new Error('useLocale must be used inside an I18nProvider')
  return locale
}

/**
 * Gives the tree its translated messages, and sets `<html lang>` and `<html dir>`.
 *
 * Changing the language loads that language's messages and font stylesheets first, then
 * switches the text, the page language and the direction together. Until then the
 * previous language stays on screen, so a visitor never sees raw message keys. The font
 * files themselves download after the stylesheet is in, and swap in as they arrive.
 *
 * English is the only language bundled with the app. For a returning visitor, the page
 * loads their saved language before React starts and passes it in as `initial`, so the
 * very first frame is already in that language (see `startup.ts`). Without it, the saved
 * language replaces English a moment after the first paint. Until a language has loaded,
 * the provider leaves `lang` and `dir` as the page has them, so a page that set them early
 * for the saved language does not flip direction twice.
 */
export function I18nProvider({
  children,
  initial,
}: {
  children: ReactNode
  /** Messages for the asked-for language, loaded together with its fonts. */
  initial?: PreloadedLanguage
}) {
  const { locale } = usePrefs()
  // Null until the first language has loaded. The bundled English is on screen meanwhile.
  const [loaded, setLoaded] = useState<Loaded | null>(() =>
    initial?.locale === locale ? initial : null,
  )
  // The language that could not be loaded, so the effect below does not ask for it again
  // and again. Chosen again after another one loads, it gets a fresh try.
  const [failed, setFailed] = useState<LocaleCode | null>(null)
  const shown = loaded?.locale ?? 'en'

  useEffect(() => {
    // Already on screen, preloaded or chosen earlier: there is nothing to fetch.
    if (loaded?.locale === locale || failed === locale) return
    let current = true
    // The loaders catch their own failures today, but a missing translation or font must
    // never leave the page unable to switch, so a rejection shows English, as at startup.
    Promise.all([loadMessages(locale), loadFonts(locale)]).then(
      ([messages]) => {
        // The visitor may have chosen another language while this one was loading.
        if (!current) return
        setFailed(null)
        setLoaded({ locale, messages })
      },
      () => {
        if (!current) return
        setFailed(locale)
        setLoaded(ENGLISH)
      },
    )
    return () => {
      current = false
    }
  }, [locale, loaded, failed])

  // Before paint, so there is no frame of new text in the old direction. It only writes
  // what differs, so a page that already carries the right values is left untouched.
  useLayoutEffect(() => {
    if (!loaded) return
    const { intl, dir } = LOCALES[loaded.locale]
    const page = document.documentElement
    if (page.lang !== intl) page.lang = intl
    if (page.dir !== dir) page.dir = dir
  }, [loaded])

  return (
    <IntlProvider
      locale={LOCALES[shown].intl}
      defaultLocale="en"
      messages={loaded?.messages ?? en}
    >
      <DisplayedLocaleContext value={shown}>{children}</DisplayedLocaleContext>
    </IntlProvider>
  )
}
