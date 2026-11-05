import { useId, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { MIN_MONTHS_FOR_CV } from '../domain/measures'
import { HIGHEST_SCORE, type LedgerLine, type ScoreResult } from '../domain/score'
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
import { MonthsMessage, savingsRateForm, ShareMessage } from './FigureMessage'
import styles from './Ledger.module.css'

interface LedgerProps {
  /** A scored result. The page shows a notice instead for the other statuses. */
  result: ScoreResult
  /** Uncategorised money out as a share of spending (spec 5.3). */
  uncategorisedShare: number
}

/** A measure's own number, in plain words. Null when it could not be worked out. */
function plainValue({ id, raw }: LedgerLine, locale: LocaleCode): ReactNode {
  if (raw === null) return null

  switch (id) {
    case 'savingsRate': {
      const form = savingsRateForm(raw)
      return form === 'even' ? (
        <FormattedMessage id="ledger.value.savingsRate.even" />
      ) : (
        <FormattedMessage
          id={`ledger.value.savingsRate.${form}`}
          values={{ share: formatPercent(Math.abs(raw), locale) }}
        />
      )
    }
    case 'emergencySavings':
      return raw === 0 ? (
        <FormattedMessage id="ledger.value.emergencySavings.none" />
      ) : (
        <MonthsMessage id="ledger.value.emergencySavings" months={raw} />
      )
    case 'debtPayments':
      return raw === 0 ? (
        <FormattedMessage id="ledger.value.debtPayments.none" />
      ) : (
        <ShareMessage id="ledger.value.debtPayments" share={raw} />
      )
    case 'needsWants':
      return <ShareMessage id="ledger.value.needsWants" share={raw} />
    case 'stability':
      return <ShareMessage id="ledger.value.stability" share={raw} />
  }
}

function LedgerRow({ line }: { line: LedgerLine }) {
  const intl = useIntl()
  const locale = useLocale()
  const { id, subScore, band, weightTenths, pointsHundredths, notScoredReason } = line
  const value = plainValue(line, locale)
  const scored = subScore !== null && band !== null

  return (
    <tr role="row" className={scored ? undefined : styles.unscored}>
      <th role="rowheader" scope="row" className={styles.measure}>
        <span className={styles.name}>
          <FormattedMessage id={`measure.${id}.name`} />
        </span>
        {value && <span className={styles.value}>{value}</span>}
      </th>
      <td role="cell" className={styles.scoreCell}>
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
      <td role="cell"
        className={`${styles.end} ${styles.weight}`}
        data-label={intl.formatMessage({ id: 'ledger.weight' })}
      >
        {scored ? formatWeight(weightTenths, locale) : NO_VALUE}
      </td>
      <td role="cell" className={`${styles.end} ${styles.points}`}>
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

      {/* Named by the heading, so the table is announced as "How 66 adds up". */}
      <table role="table" className={styles.table} aria-labelledby={titleId}>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              <FormattedMessage id="ledger.measure" />
            </th>
            <th role="columnheader" scope="col">
              <FormattedMessage id="ledger.score" />
            </th>
            <th role="columnheader" scope="col" className={styles.end}>
              <FormattedMessage id="ledger.weight" />
            </th>
            <th role="columnheader" scope="col" className={styles.end}>
              <FormattedMessage id="ledger.points" />
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {lines.map((line) => (
            <LedgerRow key={line.id} line={line} />
          ))}
        </tbody>
        <tfoot role="rowgroup">
          <tr role="row" className={styles.total}>
            <th role="rowheader" scope="row" colSpan={3}>
              <FormattedMessage id="ledger.total" />
            </th>
            <td role="cell" className={styles.end}>{formatPoints(totalHundredths, locale)}</td>
          </tr>
          <tr role="row" className={styles.final}>
            <th role="rowheader" scope="row" colSpan={3}>
              <FormattedMessage id="ledger.rounded" />
            </th>
            <td role="cell" className={styles.end}>
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
          <ShareMessage id="ledger.uncategorised" share={uncategorisedShare} />
        </p>
      )}
    </section>
  )
}
