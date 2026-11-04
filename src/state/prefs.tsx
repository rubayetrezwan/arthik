import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { isCurrencyCode, type CurrencyCode } from '../domain/types'
import { isLocaleCode, type LocaleCode } from '../i18n/locales'
import { safeGet, safeSet } from './storage'

// The visitor's language and display currency, remembered on this device. They are never
// guessed from the browser: Arthik opens in English and taka until the visitor chooses.

const LOCALE_KEY = 'arthik.locale'
const CURRENCY_KEY = 'arthik.currency'

const DEFAULT_LOCALE: LocaleCode = 'en'
const DEFAULT_CURRENCY: CurrencyCode = 'BDT'

export interface Prefs {
  locale: LocaleCode
  setLocale(l: LocaleCode): void
  currency: CurrencyCode
  setCurrency(c: CurrencyCode): void
}

const PrefsContext = createContext<Prefs | null>(null)

/**
 * The remembered language, or English. The page reads it before React starts too, to set
 * up the visitor's language before the first frame, so both must read it the same way.
 */
export function readStoredLocale(): LocaleCode {
  const value = safeGet(LOCALE_KEY)
  return value !== null && isLocaleCode(value) ? value : DEFAULT_LOCALE
}

function storedCurrency(): CurrencyCode {
  const value = safeGet(CURRENCY_KEY)
  return value !== null && isCurrencyCode(value) ? value : DEFAULT_CURRENCY
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(readStoredLocale)
  const [currency, setCurrencyState] = useState(storedCurrency)

  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l)
    safeSet(LOCALE_KEY, l)
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCurrencyState(c)
    safeSet(CURRENCY_KEY, c)
  }, [])

  const prefs = useMemo(
    () => ({ locale, setLocale, currency, setCurrency }),
    [locale, setLocale, currency, setCurrency],
  )

  return <PrefsContext value={prefs}>{children}</PrefsContext>
}

export function usePrefs(): Prefs {
  const prefs = useContext(PrefsContext)
  if (!prefs) throw new Error('usePrefs must be used inside a PrefsProvider')
  return prefs
}
