import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { IntlProvider } from 'react-intl'
import { usePrefs } from '../state/prefs'
import { loadFonts } from './fonts'
import { loadMessages, type Messages } from './loadMessages'
import { LOCALES, type LocaleCode } from './locales'
import en from './messages/en.json'

interface Loaded {
  locale: LocaleCode
  messages: Messages
}

/**
 * Gives the tree its translated messages, and sets `<html lang>` and `<html dir>`.
 *
 * Changing the language loads that language's messages and fonts first, then switches
 * the text, the page language and the direction together. Until then the previous
 * language stays on screen, so a visitor never sees raw message keys. English is the only
 * language bundled with the app, so a returning visitor's saved language replaces it a
 * moment after the first paint.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { locale } = usePrefs()
  const [loaded, setLoaded] = useState<Loaded>({ locale: 'en', messages: en })

  useEffect(() => {
    let current = true
    // Neither promise rejects: a missing translation or font falls back, it does not fail.
    Promise.all([loadMessages(locale), loadFonts(locale)]).then(([messages]) => {
      // The visitor may have chosen another language while this one was loading.
      if (current) setLoaded({ locale, messages })
    })
    return () => {
      current = false
    }
  }, [locale])

  // Before paint, so there is no frame of new text in the old direction.
  useLayoutEffect(() => {
    const { intl, dir } = LOCALES[loaded.locale]
    document.documentElement.lang = intl
    document.documentElement.dir = dir
  }, [loaded.locale])

  return (
    <IntlProvider
      locale={LOCALES[loaded.locale].intl}
      defaultLocale="en"
      messages={loaded.messages}
    >
      {children}
    </IntlProvider>
  )
}
