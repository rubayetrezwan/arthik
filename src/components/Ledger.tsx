import { useId, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { MIN_MONTHS_FOR_CV } from '../domain/measures'
import type { LedgerLine, ScoreResult } from '../domain/score'
import {
  formatNumber,
  formatPercent,
  formatPoints,
  formatWeight,
  NO_VALUE,
} from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import type { LocaleCode } from '../i18n/locales'
import { Bullet } from './Bullet'
import styles from './Ledger.module.css'

const HIGHEST_SCORE = 100

interface LedgerProps {
  /** A scored result. The page shows a notice instead for the other statuses. */
  result: ScoreResult
  /** Uncategorised money out as a share of spending (spec 5.3). */
  uncategorisedShare: number
}

/** The smallest share and the fewest months shown as a number; anything less but above 0 says so. */
const SMALLEST_SHARE = 0.01
const FEWEST_MONTHS = 0.1

/**
 * A message that states a share of something. A share above 0 that would round to 0% uses
 * the message's ".under" form ("Under 1% of …"), so a tiny amount never reads as none.
 */
function shareMessage(id: string, ratio: number, locale: LocaleCode): ReactNode {
  const tiny = ratio > 0 && Math.round(ratio * 100) === 0
  return (
    <FormattedMessage
      id={tiny ? `${id}.under` : id}
      values={{ share: formatPercent(tiny ? SMALLEST_SHARE : ratio, locale) }}
    />
  )
}

/** A measure's own number, in plain words. Null when it could not be worked out. */
function plainValue({ id, raw }: LedgerLine, locale: LocaleCode): ReactNode {
  if (raw === null) return null
  const share = (ratio: number) => formatPercent(ratio, locale)

  switch (id) {
    case 'savingsRate': {
      const whole = Math.round(raw * 100)
      if (whole > 0) {
        return <FormattedMessage id="ledger.value.savingsRate.kept" values={{ share: share(raw) }} />
      }
      if (whole < 0) {
        return <FormattedMessage id="ledger.value.savingsRate.over" values={{ share: share(-raw) }} />
      }
      return <FormattedMessage id="ledger.value.savingsRate.even" />
    }
    case 'emergencySavings': {
      if (raw === 0) return <FormattedMessage id="ledger.value.emergencySavings.none" />
      // Months are shown to one decimal, so a buffer under 0.05 months would read "0.0".
      const tiny = Math.round(raw * 10) === 0
      return (
        <FormattedMessage
          id={tiny ? 'ledger.value.emergencySavings.under' : 'ledger.value.emergencySavings'}
          values={{ months: formatNumber(tiny ? FEWEST_MONTHS : raw, locale, 1) }}
        />
      )
    }
    case 'debtPayments':
      return raw === 0 ? (
        <FormattedMessage id="ledger.value.debtPayments.none" />
      ) : (
        shareMessage('ledger.value.debtPayments', raw, locale)
      )
    case 'needsWants':
      return shareMessage('ledger.value.needsWants', raw, locale)
    case 'stability':
      return shareMessage('ledger.value.stability', raw, locale)
  }
}

function LedgerRow({ line }: { line: LedgerLine }) {
  const intl = useIntl()
  const locale = useLocale()
  const { id, subScore, band, weightTenths, pointsHundredths, notScoredReason } = line
  const value = plainValue(line, locale)
  const scored = subScore !== null && band !== null

  return (
    <tr className={scored ? undefined : styles.unscored}>
      <th scope="row" className={styles.measure}>
        <span className={styles.name}>
          <FormattedMessage id={`measure.${id}.name`} />
        </span>
        {value && <span className={styles.value}>{value}</span>}
      </th>
      <td className={styles.scoreCell}>
        {scored ? (
          <>
            <span className={styles.scoreLine}>
              <b>
                <FormattedMessage
                  id="ledger.outOf"
                  values={{
                    score: formatNumber(subScore, locale),
                    max: formatNumber(HIGHEST_SCORE, locale),
                  }}
                />
              </b>
              <span>
                <FormattedMessage id={`band.${band}`} />
              </span>
            </span>
            <Bullet score={subScore} />
          </>
        ) : (
          <>
            <span className={styles.scoreLine}>
              <b>
                <FormattedMessage id="ledger.notScored" />
              </b>
            </span>
            {notScoredReason && (
              <span className={styles.reason}>
                <FormattedMessage
                  id={`notScored.${notScoredReason}`}
                  values={{ count: MIN_MONTHS_FOR_CV }}
                />
              </span>
            )}
          </>
        )}
      </td>
      {/*
        Re-weighted lines show the weight they count for now, such as 33.3%. On phones the
        column headings are hidden, so the cell names itself from data-label.
      */}
      <td
        className={`${styles.end} ${styles.weight}`}
        data-label={intl.formatMessage({ id: 'ledger.weight' })}
      >
        {scored ? formatWeight(weightTenths, locale) : NO_VALUE}
      </td>
      <td className={`${styles.end} ${styles.points}`}>
        {pointsHundredths === null ? NO_VALUE : formatPoints(pointsHundredths, locale)}
      </td>
    </tr>
  )
}

/**
 * How the score adds up, as an account book would show it: each measure's points, the
 * total, and the score it rounds to, double-ruled. The total is of points only. Weights
 * are never totalled, because shared-out weights are rounded and need not make 100%.
 */
export function Ledger({ result, uncategorisedShare }: LedgerProps) {
  const locale = useLocale()
  const titleId = useId()
  const { status, score, totalHundredths, lines } = result
  if (status !== 'scored' || score === null || totalHundredths === null) return null

  const reweighted = lines.some((line) => line.subScore === null)

  return (
    <section className={styles.sheet} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id="ledger.title" values={{ score: formatNumber(score, locale) }} />
      </h2>
      <p className={styles.note}>
        <FormattedMessage
          id="ledger.note"
          values={{ max: formatNumber(HIGHEST_SCORE, locale) }}
        />
      </p>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">
              <FormattedMessage id="ledger.measure" />
            </th>
            <th scope="col">
              <FormattedMessage id="ledger.score" />
            </th>
            <th scope="col" className={styles.end}>
              <FormattedMessage id="ledger.weight" />
            </th>
            <th scope="col" className={styles.end}>
              <FormattedMessage id="ledger.points" />
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <LedgerRow key={line.id} line={line} />
          ))}
        </tbody>
        <tfoot>
          <tr className={styles.total}>
            <th scope="row" colSpan={3}>
              <FormattedMessage id="ledger.total" />
            </th>
            <td className={styles.end}>{formatPoints(totalHundredths, locale)}</td>
          </tr>
          <tr className={styles.final}>
            <th scope="row" colSpan={3}>
              <FormattedMessage id="ledger.rounded" />
            </th>
            <td className={styles.end}>
              <span className={styles.grand}>{formatNumber(score, locale)}</span>
            </td>
          </tr>
        </tfoot>
      </table>

      {reweighted && (
        <p className={styles.foot}>
          <FormattedMessage id="ledger.reweighted" />
        </p>
      )}
      <p className={styles.foot}>
        <FormattedMessage id="ledger.foot" />
      </p>
      {uncategorisedShare > 0 && (
        <p className={styles.uncategorised}>
          {shareMessage('ledger.uncategorised', uncategorisedShare, locale)}
        </p>
      )}
    </section>
  )
}
