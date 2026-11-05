import { useMemo } from 'react'
import { SAMPLES } from '../data/samples'
import { summaryValues } from '../data/samples/summaryValues'
import { computeMeasures } from '../domain/measures'
import { useLocale } from '../i18n/I18nProvider'

/**
 * The figures behind "habits, not income", from the sample people's own data and in the
 * same form as their summaries: the facts are checked in samples.test.ts (R3). Worked out
 * once for each language on screen, not on every render.
 */
export function useHabitsFigures() {
  const locale = useLocale()
  return useMemo(
    () => ({
      incomeMultiple: summaryValues('farhana', computeMeasures(SAMPLES.farhana), locale)
        .incomeMultiple,
      sentHomeShare: summaryValues('rahim', computeMeasures(SAMPLES.rahim), locale)
        .sentHomeShare,
    }),
    [locale],
  )
}
