import { useId } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { groupOf } from '../domain/categories'
import { MIN_MONTHS_FOR_CV } from '../domain/measures'
import { EDGE_DAYS } from '../domain/period'
import { MEASURE_IDS, MIN_SCORED_MEASURES, type ScoreResult } from '../domain/score'
import type { Dataset } from '../domain/types'
import { formatFullDate, formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import styles from './NotScoredNotice.module.css'

interface NotScoredNoticeProps {
  /** A result with no overall score: `no_data`, `no_income` or `too_few_measures`. */
  result: ScoreResult
  dataset: Dataset
}

/** The first and last dates in the data, or null when there are none. */
function dateRange(dataset: Dataset): { first: string; last: string } | null {
  const dates = dataset.transactions.map((transaction) => transaction.date).sort()
  const first = dates[0]
  const last = dates.at(-1)
  return first !== undefined && last !== undefined ? { first, last } : null
}

/**
 * Shown in place of the score when there is none, saying plainly why and what to add.
 * It never shows a stand-in number.
 */
export function NotScoredNotice({ result, dataset }: NotScoredNoticeProps) {
  const intl = useIntl()
  const locale = useLocale()
  const titleId = useId()
  if (result.status === 'scored') return null

  const day = (date: string) => <time dateTime={date}>{formatFullDate(date, locale)}</time>

  let body
  if (result.status === 'no_data') {
    const range = dateRange(dataset)
    body = (
      <>
        <p className={styles.lead}>
          <FormattedMessage id="noScore.no_data" />
        </p>
        <p>
          <FormattedMessage
            id="noScore.no_data.rule"
            values={{ days: formatNumber(EDGE_DAYS, locale) }}
          />
        </p>
        {range && (
          <p>
            <FormattedMessage
              id="noScore.no_data.range"
              values={{ first: day(range.first), last: day(range.last) }}
            />
          </p>
        )}
      </>
    )
  } else if (result.status === 'no_income') {
    // A file with no income anywhere is usually a wallet-only export (spec 5.3).
    const noIncomeInFile =
      dataset.key === 'mine' &&
      !dataset.transactions.some((transaction) => groupOf(transaction.category) === 'income')
    body = (
      <>
        <p className={styles.lead}>
          <FormattedMessage id={noIncomeInFile ? 'noScore.no_income.file' : 'noScore.no_income'} />
        </p>
        <p>
          <FormattedMessage id="noScore.no_income.why" />
        </p>
      </>
    )
  } else {
    const missing = result.lines.filter((line) => line.subScore === null)
    body = (
      <>
        <p className={styles.lead}>
          <FormattedMessage
            id="noScore.too_few_measures"
            values={{
              count: formatNumber(result.lines.length - missing.length, locale),
              total: formatNumber(MEASURE_IDS.length, locale),
              min: formatNumber(MIN_SCORED_MEASURES, locale),
            }}
          />
        </p>
        <ul className={styles.missing}>
          {missing.map(({ id, notScoredReason }) => (
            <li key={id}>
              <FormattedMessage
                id="noScore.missing"
                values={{
                  measure: (
                    <span className={styles.measure}>
                      {intl.formatMessage({ id: `measure.${id}.name` })}
                    </span>
                  ),
                  reason:
                    notScoredReason &&
                    intl.formatMessage(
                      { id: `notScored.${notScoredReason}` },
                      { count: MIN_MONTHS_FOR_CV },
                    ),
                }}
              />
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <section className={styles.notice} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id="noScore.title" />
      </h2>
      {body}
    </section>
  )
}
