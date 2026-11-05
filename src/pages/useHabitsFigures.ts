import { useEffect, useMemo, useState } from 'react'
import { getLoadedSample, loadSample } from '../data/samples/loadSamples'
import { summaryValues } from '../data/samples/summaryValues'
import { computeMeasures } from '../domain/measures'
import type { Dataset } from '../domain/types'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'

interface People {
  farhana: Dataset | undefined
  rahim: Dataset | undefined
}

const loadedPeople = (): People => ({
  farhana: getLoadedSample('farhana'),
  rahim: getLoadedSample('rahim'),
})

/**
 * The figures behind "habits, not income", from the sample people's own data and in the
 * same form as their summaries: the facts are checked in samples.test.ts (R3). Worked out
 * once for each language on screen, not on every render. The two people's data is fetched
 * the first time this page is read; until then each figure is an em dash.
 */
export function useHabitsFigures() {
  const locale = useLocale()
  const [people, setPeople] = useState<People>(loadedPeople)
  const missing = people.farhana === undefined || people.rahim === undefined

  useEffect(() => {
    if (!missing) return
    let live = true
    Promise.all([loadSample('farhana'), loadSample('rahim')])
      .then(() => live && setPeople(loadedPeople()))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [missing])

  return useMemo(() => {
    const dash = formatNumber(NaN, locale)
    return {
      incomeMultiple: people.farhana
        ? summaryValues('farhana', computeMeasures(people.farhana), locale).incomeMultiple
        : dash,
      sentHomeShare: people.rahim
        ? summaryValues('rahim', computeMeasures(people.rahim), locale).sentHomeShare
        : dash,
    }
  }, [locale, people])
}
