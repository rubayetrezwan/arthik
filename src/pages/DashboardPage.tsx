import { useId, useMemo } from 'react'
import { FormattedMessage } from 'react-intl'
import { CategoryChart } from '../components/CategoryChart'
import { Ledger } from '../components/Ledger'
import { MonthlyChart } from '../components/MonthlyChart'
import { NotScoredNotice } from '../components/NotScoredNotice'
import { PageHead } from '../components/PageHead'
import { ReasonsAndTips } from '../components/ReasonsAndTips'
import { ScoreCard } from '../components/ScoreCard'
import { TransactionsTable } from '../components/TransactionsTable'
import { WhatIf } from '../components/WhatIf'
import { getLoadedSample } from '../data/samples/loadSamples'
import { summaryValues } from '../data/samples/summaryValues'
import type { Dataset, PersonId } from '../domain/types'
import { useScoreStatus, type Scored } from '../hooks/useScore'
import { formatMonthRange } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { useSession } from '../state/session'
import styles from './DashboardPage.module.css'

/**
 * The sample person whose written words fit this dataset, or null. They describe a sample
 * as it was generated; once a category is changed they may no longer match the numbers, so
 * they step aside.
 */
function asWritten(dataset: Dataset | undefined): PersonId | null {
  if (!dataset || dataset.key === 'mine') return null
  return dataset === getLoadedSample(dataset.key) ? dataset.key : null
}

/**
 * "Explore your money", under the score sheet: the reasons and the what-if sliders when
 * there is a score (R14), then the charts and every transaction. The transactions show
 * even without a score, since changing a category there may be what gets one.
 */
function Explore({ scored: { dataset, measures, result } }: { scored: Scored }) {
  const { overrideCategory } = useSession()
  const titleId = useId()
  const hasScore = result.status === 'scored'

  return (
    <section className={styles.explore} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.exploreTitle}>
        <FormattedMessage id="explore.title" />
      </h2>
      {hasScore && <ReasonsAndTips dataset={dataset} measures={measures} result={result} />}
      {hasScore && <WhatIf dataset={dataset} measures={measures} result={result} />}
      {/* A chart with nothing to draw steps aside; with neither, the row goes too. */}
      <div className={styles.charts}>
        <MonthlyChart measures={measures} />
        <CategoryChart measures={measures} />
      </div>
      {/* Keyed by person, so a page of "Show more" is kept when only a category changes. */}
      <TransactionsTable
        key={dataset.key}
        transactions={dataset.transactions}
        onCategoryChange={overrideCategory}
      />
    </section>
  )
}

/** A sample person's score, or the visitor's own: the page head, the score sheet, then the rest. */
export function DashboardPage() {
  const locale = useLocale()
  const { scored, status } = useScoreStatus()

  const writtenFor = asWritten(scored?.dataset)
  const measures = scored?.measures
  // Worked out when the person, their data or the language changes, not on every render.
  const summary = useMemo(
    () => (writtenFor && measures ? summaryValues(writtenFor, measures, locale) : null),
    [writtenFor, measures, locale],
  )

  if (!scored) {
    // A sample person's data is on its way. The space is held, so the page does not jump.
    return status === 'ready' ? null : (
      <p className={styles.loading} role="status">
        <FormattedMessage id={status === 'failed' ? 'shell.loadFailed' : 'shell.loading'} />
      </p>
    )
  }
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

      {dataset.transactions.length > 0 && <Explore scored={scored} />}
    </>
  )
}
