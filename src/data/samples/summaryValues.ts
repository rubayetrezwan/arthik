// The numbers each sample person's written summary (`sample.<id>.summary`) fills in.
// The summaries never type a number (spec 5.5); every other claim in them is checked
// against the data in samples.test.ts (Ruling R3). All are ratios, months or multiples,
// so they read the same in any display currency. Pure: no React, no state.

import { computeMeasures, type Measures } from '../../domain/measures'
import type { PersonId } from '../../domain/types'
import { formatNumber, formatPercent } from '../../i18n/format'
import type { LocaleCode } from '../../i18n/locales'
import { getLoadedSample } from './loadSamples'

/** How each placeholder is written: shares as whole percentages, months with one decimal. */
const FORMATS = {
  savedShare: formatPercent,
  overspendShare: formatPercent,
  debtShare: formatPercent,
  wantsShare: formatPercent,
  sentHomeShare: formatPercent,
  bufferMonths: (n: number, locale: LocaleCode) => formatNumber(n, locale, 1),
  incomeMultiple: (n: number, locale: LocaleCode) => formatNumber(n, locale, 0),
} satisfies Record<string, (n: number, locale: LocaleCode) => string>

export type Placeholder = keyof typeof FORMATS

/** One person's placeholders as plain numbers. Null where the data has no such number. */
export type SummaryFigures = Partial<Record<Placeholder, number | null>>

/** Money sent to family as a share of income. */
function sentHomeShare(m: Measures): number | null {
  const sent = (m.categoryMonthlyAvg.family_support_out ?? 0) * m.months.length
  return m.income > 0 ? sent / m.income : null
}

/**
 * Nusrat's income, which Farhana's summary compares hers with. Null until Nusrat's data has
 * been loaded (loadSample loads it together with Farhana's).
 */
function nusratIncome(): number | null {
  const nusrat = getLoadedSample('nusrat')
  return nusrat ? computeMeasures(nusrat).income : null
}

const FIGURES: Record<PersonId, (m: Measures) => SummaryFigures> = {
  nusrat: (m) => ({ savedShare: m.savingsRate, bufferMonths: m.bufferMonths }),
  tanvir: (m) => ({
    savedShare: m.savingsRate,
    wantsShare: m.wantsShare,
    bufferMonths: m.bufferMonths,
  }),
  farhana: (m) => {
    const income = nusratIncome()
    return {
      // "You earn nearly {incomeMultiple} times what Nusrat has coming in."
      incomeMultiple: income === null ? null : m.income / income,
      debtShare: m.debtRatio,
      overspendShare: m.savingsRate === null ? null : -m.savingsRate,
    }
  },
  arif: (m) => ({ savedShare: m.savingsRate, bufferMonths: m.bufferMonths }),
  rahim: (m) => ({
    sentHomeShare: sentHomeShare(m),
    savedShare: m.savingsRate,
    bufferMonths: m.bufferMonths,
  }),
}

/** The numbers behind a person's summary, from their measures. */
export function summaryFigures(id: PersonId, measures: Measures): SummaryFigures {
  return FIGURES[id](measures)
}

/** The same numbers written out for the language on screen, ready to fill the summary. */
export function summaryValues(
  id: PersonId,
  measures: Measures,
  locale: LocaleCode,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(summaryFigures(id, measures)).map(([name, value]) => [
      name,
      // A missing number shows as the em dash, never as "NaN".
      FORMATS[name as Placeholder](value ?? NaN, locale),
    ]),
  )
}
