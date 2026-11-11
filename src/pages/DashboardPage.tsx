import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { AddSavings } from '../components/AddSavings'
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
import { HIGHEST_SCORE, MEASURE_IDS } from '../domain/score'
import type { Dataset, PersonId } from '../domain/types'
import { useScoreStatus, type Scored } from '../hooks/useScore'
import { formatMonthRange, formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { useSession, type DatasetKey } from '../state/session'
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
  const intl = useIntl()
  const locale = useLocale()
  const { scored, status } = useScoreStatus()
  // The file whose savings were just added in the ledger: focus goes to the score, and the
  // new score is announced, once it has been worked out again.
  const [savingsAddedFor, setSavingsAddedFor] = useState<DatasetKey | null>(null)
  const scoreHeading = useRef<HTMLHeadingElement>(null)
  const savingsAdded = savingsAddedFor !== null && savingsAddedFor === scored?.dataset.key

  useEffect(() => {
    if (savingsAdded) scoreHeading.current?.focus()
  }, [savingsAdded])

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
  // Whenever a measure is left out the score rests on fewer than all of them, and says so.
  const left = result.lines.filter((line) => line.subScore === null)
  const basis =
    left.length > 0
      ? {
          scored: result.lines.length - left.length,
          total: MEASURE_IDS.length,
          missingSavings: left.some(
            (line) => line.id === 'emergencySavings' && line.notScoredReason === 'no_savings_given',
          ),
        }
      : undefined

  const announcement =
    savingsAdded && result.score !== null && result.band !== null
      ? intl.formatMessage(
          { id: 'score.savings.updated' },
          {
            score: formatNumber(result.score, locale),
            max: formatNumber(HIGHEST_SCORE, locale),
            band: intl.formatMessage({ id: `band.${result.band}` }),
          },
        )
      : ''

  return (
    <>
      {/*
        The visitor's own file can take savings in the ledger. The region is there from the
        start, so a screen reader hears the new score when it arrives.
      */}
      {dataset.key === 'mine' && (
        <p className="visually-hidden" role="status" data-testid="score-announcement">
          {announcement}
        </p>
      )}
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
        {result.status === 'scored' && (
          <p data-print="hide">
            <button type="button" className={styles.print} onClick={() => window.print()}>
              <FormattedMessage id="score.print" />
            </button>
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
            basis={basis}
            headingRef={scoreHeading}
          />
          <Ledger
            result={result}
            uncategorisedShare={scored.measures.uncategorisedShare}
            savingsEntry={
              dataset.key === 'mine' ? (
                <AddSavings onAdded={() => setSavingsAddedFor(dataset.key)} />
              ) : undefined
            }
          />
        </div>
      ) : (
        <NotScoredNotice result={result} dataset={dataset} />
      )}

      {dataset.transactions.length > 0 && <Explore scored={scored} />}
    </>
  )
}
