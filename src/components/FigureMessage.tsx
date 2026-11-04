import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { formatNumber, formatPercent } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'

// Messages that state a small figure about the visitor's money: a share, or months of
// essentials. A figure above 0 that would be shown as 0 never reads as none (R49). The
// ledger and the reasons both state these figures, and both use these.

/** The smallest share and the fewest months shown as a number; anything less but above 0 says so. */
const SMALLEST_SHARE = 0.01
const FEWEST_MONTHS = 0.1

type Values = Record<string, ReactNode>

/**
 * A message that states a share of something as `{share}`. A share above 0 that would round
 * to 0% uses the message's ".under" form ("Under 1% of …").
 */
export function ShareMessage({ id, share, values }: { id: string; share: number; values?: Values }) {
  const locale = useLocale()
  const tiny = share > 0 && Math.round(share * 100) === 0

  return (
    <FormattedMessage
      id={tiny ? `${id}.under` : id}
      values={{ ...values, share: formatPercent(tiny ? SMALLEST_SHARE : share, locale) }}
    />
  )
}

/**
 * A message that states months of essentials as `{months}`, to one decimal. Months above 0
 * that would read "0.0" use the message's ".under" form ("less than 0.1 months").
 */
export function MonthsMessage({ id, months, values }: { id: string; months: number; values?: Values }) {
  const locale = useLocale()
  const tiny = months > 0 && Math.round(months * 10) === 0

  return (
    <FormattedMessage
      id={tiny ? `${id}.under` : id}
      values={{ ...values, months: formatNumber(tiny ? FEWEST_MONTHS : months, locale, 1) }}
    />
  )
}

/**
 * How a savings rate is put into words, judged on the whole percentage shown: some kept,
 * more paid out than earned, or about as much spent as earned when it rounds to 0%.
 */
export function savingsRateForm(rate: number): 'kept' | 'over' | 'even' {
  const whole = Math.round(rate * 100)
  if (whole > 0) return 'kept'
  return whole < 0 ? 'over' : 'even'
}
