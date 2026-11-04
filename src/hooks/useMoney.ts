import { useCallback } from 'react'
import { convert } from '../domain/currency'
import type { CurrencyCode } from '../domain/types'
import { formatMoney } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { usePrefs } from '../state/prefs'

/**
 * Formats an amount in the visitor's display currency, in the language on screen. Amounts
 * are in taka unless `from` says otherwise, as the domain keeps them. A tiny amount that is
 * not zero never reads as zero (R49).
 */
export function useMoney(): (
  amount: number,
  from?: CurrencyCode,
  opts?: { signed?: boolean },
) => string {
  const { currency } = usePrefs()
  const locale = useLocale()

  return useCallback(
    (amount, from = 'BDT', opts = {}) =>
      formatMoney(convert(amount, from, currency), currency, locale, { ...opts, keepTiny: true }),
    [currency, locale],
  )
}
