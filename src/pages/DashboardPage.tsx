import { useMemo } from 'react'
import { FormattedMessage } from 'react-intl'
import { Ledger } from '../components/Ledger'
import { NotScoredNotice } from '../components/NotScoredNotice'
import { PageHead } from '../components/PageHead'
import { ScoreCard } from '../components/ScoreCard'
import { SAMPLES } from '../data/samples'
import { summaryValues } from '../data/samples/summaryValues'
import type { Dataset, PersonId } from '../domain/types'
import { useScore } from '../hooks/useScore'
import { formatMonthRange } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import styles from './DashboardPage.module.css'

/**
 * The sample person whose written words fit this dataset, or null. They describe a sample
 * as it was generated; once a category is changed they may no longer match the numbers, so
 * they step aside.
 */
function asWritten(dataset: Dataset | undefined): PersonId | null {
  if (!dataset || dataset.key === 'mine') return null
  return dataset === SAMPLES[dataset.key] ? dataset.key : null
}

/** A sample person's score, or the visitor's own: the page head, then the score sheet. */
export function DashboardPage() {
  const locale = useLocale()
  const scored = useScore()

  const writtenFor = asWritten(scored?.dataset)
  const measures = scored?.measures
  // Worked out when the person, their data or the language changes, not on every render.
  const summary = useMemo(
    () => (writtenFor && measures ? summaryValues(writtenFor, measures, locale) : null),
    [writtenFor, measures, locale],
  )

  if (!scored) return null
  const { dataset, result } = scored
  const person = dataset.key === 'mine' ? null : dataset.key
  const [first, last] = [result.months[0], result.months.at(-1)]

  return (
    <>
      <PageHead
        kicker={
          <FormattedMessage id={person ? `sample.${person}.kicker` : 'score.kicker.mine'} />
        }
        title={
          <FormattedMessage id={writtenFor ? `sample.${writtenFor}.headline` : 'score.title'} />
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
              writtenFor &&
              summary && <FormattedMessage id={`sample.${writtenFor}.summary`} values={summary} />
            }
            summaryHidden={person !== null && !writtenFor}
          />
          <Ledger result={result} uncategorisedShare={scored.measures.uncategorisedShare} />
        </div>
      ) : (
        <NotScoredNotice result={result} dataset={dataset} />
      )}

      {/* "Explore your money" (plan Task 13) follows here, under the score sheet. */}
    </>
  )
}
