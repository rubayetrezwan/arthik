import { useId } from 'react'
import { FormattedMessage } from 'react-intl'
import { ANCHORS, CAN_BE_NEGATIVE, interpolate, LOWEST_SCORE } from '../../domain/anchors'
import { MIN_MONTHS_FOR_CV } from '../../domain/measures'
import { HIGHEST_SCORE, MEASURE_IDS, WEIGHTS, type MeasureId } from '../../domain/score'
import { formatNumber, formatPercent, formatWeight } from '../../i18n/format'
import { useLocale } from '../../i18n/I18nProvider'
import type { LocaleCode } from '../../i18n/locales'
import styles from './Method.module.css'
import { MethodSection } from './MethodSection'

/** A measure's own number: months of essentials for emergency savings, else a percentage. */
function anchorValue(id: MeasureId, x: number, locale: LocaleCode): string {
  return id === 'emergencySavings'
    ? formatNumber(x, locale, Number.isInteger(x) ? 0 : 1)
    : formatPercent(x, locale)
}

/** WEIGHTS are whole percents; formatWeight takes tenths of a percent. */
function weight(percent: number, locale: LocaleCode): string {
  return formatWeight(percent * 10, locale)
}

/** The anchor points as a table. Below the first and above the last, the score stays the same. */
function AnchorTable({ id, nameId }: { id: MeasureId; nameId: string }) {
  const locale = useLocale()
  const anchors = ANCHORS[id]

  return (
    <table className={styles.table} aria-labelledby={nameId}>
      <thead>
        <tr>
          <th scope="col">
            <FormattedMessage id={`howItWorks.${id}.axis`} />
          </th>
          <th scope="col" className={styles.end}>
            <FormattedMessage id="ledger.score" />
          </th>
        </tr>
      </thead>
      <tbody>
        {anchors.map(([x, score], index) => {
          const value = <bdi>{anchorValue(id, x, locale)}</bdi>
          const first = index === 0 && (x !== 0 || CAN_BE_NEGATIVE.has(id))
          const last = index === anchors.length - 1
          return (
            <tr key={x}>
              <th scope="row">
                {last ? (
                  <FormattedMessage id="howItWorks.anchor.atLeast" values={{ value }} />
                ) : first ? (
                  <FormattedMessage id="howItWorks.anchor.atMost" values={{ value }} />
                ) : (
                  value
                )}
              </th>
              <td className={`${styles.end} ${styles.figure}`}>{formatNumber(score, locale)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/** One measure: what it asks, its formula, why it matters, when it isn't scored, and its anchors. */
function MeasureDetail({ id, index }: { id: MeasureId; index: number }) {
  const locale = useLocale()
  const nameId = useId()

  return (
    <section className={styles.sub}>
      <h3 className={styles.subHeading}>
        <span className={styles.numeral} aria-hidden="true">
          {formatNumber(index + 1, locale)}
        </span>
        <span id={nameId}>
          <FormattedMessage id={`measure.${id}.name`} />
        </span>
      </h3>
      <div className={styles.pair}>
        <div className={styles.prose}>
          <p className={styles.question}>
            <FormattedMessage id={`measure.${id}.question`} />
          </p>
          <p>
            <span className={styles.label}>
              <FormattedMessage id="howItWorks.formula" />
            </span>
            <span className={styles.formula}>
              <FormattedMessage id={`howItWorks.${id}.formula`} />
            </span>
          </p>
          <p>
            <FormattedMessage id={`howItWorks.${id}.detail`} />
          </p>
          <p>
            <FormattedMessage id={`howItWorks.${id}.why`} />
          </p>
          <p className={styles.note}>
            <FormattedMessage
              id={`howItWorks.${id}.notScored`}
              values={{ count: MIN_MONTHS_FOR_CV }}
            />
          </p>
        </div>
        <AnchorTable id={id} nameId={nameId} />
      </div>
    </section>
  )
}

/**
 * A point halfway between two of the savings-rate anchors, scored by the same straight
 * line the code draws, to show what "between two anchor points" means.
 */
function betweenAnchors() {
  const anchors = ANCHORS.savingsRate
  const from = anchors[1] ?? anchors[0]
  const to = anchors[2] ?? anchors[1]
  if (!from || !to) throw new Error('the savings rate needs at least two anchors')
  const x = (from[0] + to[0]) / 2
  return { x, from: from[0], to: to[0], score: Math.round(interpolate(x, anchors)) }
}

/** The five measures: what each counts for, then each in detail with its anchor points. */
export function MeasuresSection() {
  const locale = useLocale()
  const total = MEASURE_IDS.reduce((sum, id) => sum + WEIGHTS[id], 0)
  const between = betweenAnchors()

  return (
    <MethodSection titleId="howItWorks.measures.title">
      {(headingId) => (
        <>
          <p className={styles.intro}>
            <FormattedMessage
              id="howItWorks.measures.intro"
              values={{
                lowest: formatNumber(LOWEST_SCORE, locale),
                highest: formatNumber(HIGHEST_SCORE, locale),
              }}
            />
          </p>

          <div className={styles.pair}>
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
                {MEASURE_IDS.map((id) => (
                  <tr key={id}>
                    <th scope="row">
                      <span className={styles.name}>
                        <FormattedMessage id={`measure.${id}.name`} />
                      </span>
                      <span className={styles.detail}>
                        <FormattedMessage id={`measure.${id}.question`} />
                      </span>
                    </th>
                    <td className={`${styles.end} ${styles.figure}`}>{weight(WEIGHTS[id], locale)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.final}>
                  <th scope="row">
                    <FormattedMessage id="ledger.total" />
                  </th>
                  <td className={styles.end}>
                    <span className={styles.grand}>{weight(total, locale)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>

            <p className={styles.prose}>
              <FormattedMessage
                id="howItWorks.measures.anchors"
                values={{
                  share: formatPercent(between.x, locale),
                  from: formatPercent(between.from, locale),
                  to: formatPercent(between.to, locale),
                  score: formatNumber(between.score, locale),
                }}
              />
            </p>
          </div>

          {MEASURE_IDS.map((id, index) => (
            <MeasureDetail key={id} id={id} index={index} />
          ))}
        </>
      )}
    </MethodSection>
  )
}
