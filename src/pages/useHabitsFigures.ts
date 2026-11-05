import { useEffect, useMemo, useState } from 'react'
import { getLoadedSample, loadSample } from '../data/samples/loadSamples'
import { summaryValues } from '../data/samples/summaryValues'
import { computeMeasures } from '../domain/measures'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'

/**
 * The figures behind "habits, not income", from the sample people's own data and in the
 * same form as their summaries: the facts are checked in samples.test.ts (R3). Worked out
 * once for each language on screen, not on every render. The two people's data is fetched
 * the first time this page is read; until then each figure is an em dash.
 */
export function useHabitsFigures() {
  const locale = useLocale()
  const [loaded, setLoaded] = useState(
    () => getLoadedSample('farhana') !== undefined && getLoadedSample('rahim') !== undefined,
  )

  useEffect(() => {
    if (loaded) return
    let live = true
    Promise.all([loadSample('farhana'), loadSample('rahim')])
      .then(() => live && setLoaded(true))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [loaded])

  return useMemo(() => {
    const farhana = getLoadedSample('farhana')
    const rahim = getLoadedSample('rahim')
    const dash = formatNumber(NaN, locale)
    return {
      incomeMultiple: farhana
        ? summaryValues('farhana', computeMeasures(farhana), locale).incomeMultiple
        : dash,
      sentHomeShare: rahim
        ? summaryValues('rahim', computeMeasures(rahim), locale).sentHomeShare
        : dash,
    }
  }, [locale, loaded]) // `loaded` is what makes the data above appear
}
