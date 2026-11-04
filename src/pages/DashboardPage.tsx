import { FormattedMessage } from 'react-intl'
import { Ledger } from '../components/Ledger'
import { NotScoredNotice } from '../components/NotScoredNotice'
import { PageHead } from '../components/PageHead'
import { ScoreCard } from '../components/ScoreCard'
import { SAMPLES } from '../data/samples'
import { computeMeasures, type Measures } from '../domain/measures'
import type { PersonId } from '../domain/types'
import { useScore } from '../hooks/useScore'
import { formatMonthRange, formatNumber, formatPercent } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import type { LocaleCode } from '../i18n/locales'
import styles from './DashboardPage.module.css'

type Placeholders = Record<string, string>

const share = (ratio: number | null, locale: LocaleCode) => formatPercent(ratio ?? NaN, locale)
const months = (n: number | null, locale: LocaleCode) => formatNumber(n ?? NaN, locale, 1)

let nusratIncome: number | undefined

/** What Nusrat has coming in over the period, in BDT: Farhana's summary compares with it. */
function incomeOfNusrat(): number {
  nusratIncome ??= computeMeasures(SAMPLES.nusrat).income
  return nusratIncome
}

/**
 * The numbers each sample person's summary needs, worked out from their own data. The
 * summaries never type a number (spec 5.5), and every other claim in them is checked
 * against the data in samples.test.ts (R3). All are ratios or months, so they read the
 * same in any display currency.
 */
const SUMMARY_VALUES: Record<PersonId, (m: Measures, locale: LocaleCode) => Placeholders> = {
  nusrat: (m, l) => ({ savedShare: share(m.savingsRate, l), bufferMonths: months(m.bufferMonths, l) }),
  tanvir: (m, l) => ({
    savedShare: share(m.savingsRate, l),
    wantsShare: share(m.wantsShare, l),
    bufferMonths: months(m.bufferMonths, l),
  }),
  farhana: (m, l) => ({
    incomeMultiple: formatNumber(m.income / incomeOfNusrat(), l),
    debtShare: share(m.debtRatio, l),
    overspendShare: share(m.savingsRate === null ? null : -m.savingsRate, l),
  }),
  arif: (m, l) => ({ savedShare: share(m.savingsRate, l), bufferMonths: months(m.bufferMonths, l) }),
  rahim: (m, l) => ({
    sentHomeShare: share(
      m.income > 0 ? ((m.categoryMonthlyAvg.family_support_out ?? 0) * m.months.length) / m.income : null,
      l,
    ),
    savedShare: share(m.savingsRate, l),
    bufferMonths: months(m.bufferMonths, l),
  }),
}

/** A sample person's score, or the visitor's own: the page head, then the score sheet. */
export function DashboardPage() {
  const locale = useLocale()
  const scored = useScore()
  if (!scored) return null

  const { dataset, measures, result } = scored
  const person = dataset.key === 'mine' ? null : dataset.key
  // The written words describe a sample as it was generated. Once a category is changed,
  // they may no longer match the numbers, so they step aside.
  const asWritten = person !== null && dataset === SAMPLES[person]
  const [first, last] = [result.months[0], result.months.at(-1)]

  return (
    <>
      <PageHead
        kicker={
          <FormattedMessage id={person ? `sample.${person}.kicker` : 'score.kicker.mine'} />
        }
        title={
          <FormattedMessage id={asWritten ? `sample.${person}.headline` : 'score.title'} />
        }
      >
        {first !== undefined && last !== undefined && (
          <p className={styles.period}>
            <FormattedMessage
              id="score.period"
              values={{
                count: result.months.length,
                range: formatMonthRange(first, last, locale),
              }}
            />
          </p>
        )}
      </PageHead>

      {result.status === 'scored' && result.score !== null && result.band !== null ? (
        <div className={styles.sheets}>
          <ScoreCard
            score={result.score}
            band={result.band}
            summary={
              asWritten && (
                <FormattedMessage
                  id={`sample.${person}.summary`}
                  values={SUMMARY_VALUES[person](measures, locale)}
                />
              )
            }
            summaryHidden={person !== null && !asWritten}
          />
          <Ledger result={result} uncategorisedShare={measures.uncategorisedShare} />
        </div>
      ) : (
        <NotScoredNotice result={result} dataset={dataset} />
      )}

      {/* "Explore your money" (plan Task 13) follows here, under the score sheet. */}
    </>
  )
}
