import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { MEASURE_IDS, MIN_SCORED_MEASURES, type LedgerLine } from '../../domain/score'
import { formatNumber, formatPercent, formatPoints, formatWeight, NO_VALUE } from '../../i18n/format'
import { useLocale } from '../../i18n/I18nProvider'
import type { LocaleCode } from '../../i18n/locales'
import styles from './Method.module.css'
import { MethodSection, SubSection } from './MethodSection'
import { EXAMPLE, EXAMPLE_WITHOUT_SAVINGS } from './workedExample'

/** The example's own number for a measure: months of essentials, or a percentage. */
function exampleValue({ id, raw }: LedgerLine, locale: LocaleCode): ReactNode {
  if (raw === null) return null
  return id === 'emergencySavings' ? (
    <FormattedMessage id="howItWorks.example.months" values={{ months: formatNumber(raw, locale, 1) }} />
  ) : (
    <bdi>{formatPercent(raw, locale)}</bdi>
  )
}

/** The spec's example, scored by computeScore: each line's working, the total and the score. */
function ExampleTable({ headingId }: { headingId: string }) {
  const locale = useLocale()
  const { lines, totalHundredths, score } = EXAMPLE
  if (totalHundredths === null || score === null) throw new Error('the worked example must score')

  return (
    <table className={styles.table} aria-labelledby={headingId}>
      <thead>
        <tr>
          <th scope="col">
            <FormattedMessage id="ledger.measure" />
          </th>
          <th scope="col" className={styles.end}>
            <FormattedMessage id="howItWorks.example.working" />
          </th>
          <th scope="col" className={styles.end}>
            <FormattedMessage id="ledger.points" />
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.id}>
            <th scope="row">
              <span className={styles.name}>
                <FormattedMessage id={`measure.${line.id}.name`} />
              </span>
              <span className={styles.detail}>{exampleValue(line, locale)}</span>
            </th>
            <td className={styles.end}>
              {line.subScore === null ? (
                NO_VALUE
              ) : (
                <FormattedMessage
                  id="howItWorks.example.times"
                  values={{
                    score: formatNumber(line.subScore, locale),
                    weight: formatWeight(line.weightTenths, locale),
                  }}
                />
              )}
            </td>
            <td className={`${styles.end} ${styles.figure}`}>
              {line.pointsHundredths === null ? NO_VALUE : formatPoints(line.pointsHundredths, locale)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colSpan={2}>
            <FormattedMessage id="ledger.total" />
          </th>
          <td className={`${styles.end} ${styles.figure} ${styles.sum}`}>
            {formatPoints(totalHundredths, locale)}
          </td>
        </tr>
        <tr className={styles.final}>
          <th scope="row" colSpan={2}>
            <FormattedMessage id="ledger.rounded" />
          </th>
          <td className={styles.end}>
            <span className={styles.grand}>{formatNumber(score, locale)}</span>
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

/** What each measure counts for once emergency savings are left out and their weight shared. */
function ReweightTable({ headingId }: { headingId: string }) {
  const locale = useLocale()

  return (
    <table className={styles.table} aria-labelledby={headingId}>
      <thead>
        <tr>
          <th scope="col">
            <FormattedMessage id="ledger.measure" />
          </th>
          <th scope="col" className={styles.end}>
            <FormattedMessage id="ledger.weight" />
          </th>
        </tr>
      </thead>
      <tbody>
        {EXAMPLE_WITHOUT_SAVINGS.lines.map(({ id, subScore, weightTenths }) => (
          <tr key={id}>
            <th scope="row">
              <FormattedMessage id={`measure.${id}.name`} />
            </th>
            <td className={`${styles.end} ${subScore === null ? styles.note : styles.figure}`}>
              {subScore === null ? (
                <FormattedMessage id="ledger.notScored" />
              ) : (
                formatWeight(weightTenths, locale)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** From measure scores to the score: rounding, points, the total, and when there is none. */
export function PointsSection() {
  const locale = useLocale()
  const { totalHundredths, score, band } = EXAMPLE
  if (totalHundredths === null || score === null || band === null) {
    throw new Error('the worked example must score')
  }

  return (
    <MethodSection titleId="howItWorks.points.title">
      <ol className={styles.steps}>
        <li>
          <FormattedMessage id="howItWorks.points.round" />
        </li>
        <li>
          <FormattedMessage id="howItWorks.points.multiply" />
        </li>
        <li>
          <FormattedMessage id="howItWorks.points.total" />
        </li>
      </ol>

      <SubSection titleId="howItWorks.example.title">
        {(headingId) => (
          <div className={styles.worked}>
            <p className={styles.before}>
              <FormattedMessage id="howItWorks.example.intro" />
            </p>
            <ExampleTable headingId={headingId} />
            <p className={styles.after}>
              <FormattedMessage
                id="howItWorks.example.result"
                values={{
                  total: formatPoints(totalHundredths, locale),
                  score: formatNumber(score, locale),
                  band: <FormattedMessage id={`band.${band}`} />,
                }}
              />
            </p>
          </div>
        )}
      </SubSection>

      <SubSection titleId="howItWorks.reweight.title">
        {(headingId) => (
          <div className={styles.worked}>
            <p className={styles.before}>
              <FormattedMessage id="howItWorks.reweight.text" />
            </p>
            <ReweightTable headingId={headingId} />
            <p className={`${styles.after} ${styles.note}`}>
              <FormattedMessage id="howItWorks.reweight.points" />
            </p>
          </div>
        )}
      </SubSection>

      <SubSection titleId="howItWorks.noScore.title">
        <p className={styles.intro}>
          <FormattedMessage id="howItWorks.noScore.intro" />
        </p>
        <ul className={styles.list}>
          <li>
            <FormattedMessage id="howItWorks.noScore.noMonth" />
          </li>
          <li>
            <FormattedMessage id="howItWorks.noScore.noIncome" />
          </li>
          <li>
            <FormattedMessage
              id="howItWorks.noScore.tooFew"
              values={{
                min: formatNumber(MIN_SCORED_MEASURES, locale),
                total: formatNumber(MEASURE_IDS.length, locale),
              }}
            />
          </li>
        </ul>
      </SubSection>
    </MethodSection>
  )
}
