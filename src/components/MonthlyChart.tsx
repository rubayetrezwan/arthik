import { useId, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { convert } from '../domain/currency'
import type { Measures } from '../domain/measures'
import { useMoney } from '../hooks/useMoney'
import {
  currencyDecimals,
  formatMoney,
  formatMonth,
  formatMonthName,
  formatMonthRange,
} from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { usePrefs } from '../state/prefs'
import styles from './MonthlyChart.module.css'

/** The y-axis is split into this many equal parts, each a round amount. */
const AXIS_PARTS = 3
const NICE = [1, 2, 5, 10] as const

/** The smallest amount that is 1, 2 or 5 times a power of ten and at least `x`. */
function niceAtLeast(x: number, smallest: number): number {
  if (!(x > smallest)) return smallest
  const power = 10 ** Math.floor(Math.log10(x))
  return NICE.map((nice) => nice * power).find((step) => step >= x) ?? 10 * power
}

/** A month's income and spending as a share of the axis, never below 0. */
function heightOf(amount: number, top: number): string {
  return `${(Math.max(0, amount) / top) * 100}%`
}

/**
 * Money in and out for each month used, as bars (income outlined, spending filled), with
 * the axis in the display currency. The bars are summed up in words for screen readers,
 * and "Show as table" puts the same numbers in a real table.
 */
export function MonthlyChart({ measures }: { measures: Measures }) {
  const intl = useIntl()
  const locale = useLocale()
  const money = useMoney()
  const { currency } = usePrefs()
  const titleId = useId()
  const [asTable, setAsTable] = useState(false)

  const { monthly } = measures
  const display = (bdt: number) => convert(bdt, 'BDT', currency)
  const peak = Math.max(0, ...monthly.flatMap(({ income, spending }) => [income, spending]))
  const first = monthly[0]
  const last = monthly.at(-1)
  // Nothing to draw: no complete month, or no money in or out in any of them.
  if (!first || !last || !(peak > 0)) return null

  const smallest = 1 / 10 ** currencyDecimals(currency)
  const part = niceAtLeast(display(peak) / AXIS_PARTS, smallest)
  const top = part * AXIS_PARTS
  const ticks = Array.from({ length: AXIS_PARTS + 1 }, (_, index) => (AXIS_PARTS - index) * part)

  /** "from X to Y a month", or "X every month" when every month shows the same amount. */
  const range = (kind: 'income' | 'spending') => {
    const amounts = monthly.map((month) => month[kind])
    const [low, high] = [money(Math.min(...amounts)), money(Math.max(...amounts))]
    return low === high
      ? intl.formatMessage({ id: `chart.monthly.${kind}.same` }, { amount: low })
      : intl.formatMessage({ id: `chart.monthly.${kind}.range` }, { low, high })
  }
  const over = monthly.filter((month) => month.spending > month.income)
  const alt = intl.formatMessage(
    { id: 'chart.monthly.alt' },
    {
      range: formatMonthRange(first.month, last.month, locale),
      income: range('income'),
      spending: range('spending'),
      over:
        over.length > 0
          ? intl.formatMessage(
              { id: 'chart.monthly.over' },
              { months: intl.formatList(over.map((month) => formatMonth(month.month, locale))) },
            )
          : intl.formatMessage({ id: 'chart.monthly.over.none' }),
    },
  )

  return (
    <section aria-labelledby={titleId}>
      <div className={styles.head}>
        <h3 id={titleId} className={styles.title}>
          <FormattedMessage id="chart.monthly.title" />
        </h3>
        <button type="button" className={styles.toggle} onClick={() => setAsTable(!asTable)}>
          <FormattedMessage id={asTable ? 'chart.showChart' : 'chart.showTable'} />
        </button>
      </div>

      {asTable ? (
        <table className={styles.table} aria-labelledby={titleId}>
          <thead>
            <tr>
              <th scope="col">
                <FormattedMessage id="chart.month" />
              </th>
              <th scope="col" className={styles.end}>
                <FormattedMessage id="chart.income" />
              </th>
              <th scope="col" className={styles.end}>
                <FormattedMessage id="chart.spending" />
              </th>
            </tr>
          </thead>
          <tbody>
            {monthly.map(({ month, income, spending }) => (
              <tr key={month}>
                <th scope="row">{formatMonth(month, locale)}</th>
                <td className={styles.end}>{money(income)}</td>
                <td className={styles.end}>{money(spending)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className={styles.legend} aria-hidden="true">
            <span>
              <i className={`${styles.key} ${styles.income}`} />
              <FormattedMessage id="chart.income" />
            </span>
            <span>
              <i className={`${styles.key} ${styles.spending}`} />
              <FormattedMessage id="chart.spending" />
            </span>
          </p>
          <div className={`${styles.plot} ${monthly.length > 6 ? styles.dense : ''}`}>
            <div className={styles.yAxis} aria-hidden="true">
              {ticks.map((tick) => (
                <span key={tick} data-testid="y-label">
                  {formatMoney(tick, currency, locale)}
                </span>
              ))}
            </div>
            <div className={styles.bars} role="img" aria-label={alt}>
              {ticks.slice(0, -1).map((tick) => (
                <span
                  key={tick}
                  className={styles.gridLine}
                  style={{ insetBlockEnd: heightOf(tick, top) }}
                />
              ))}
              {monthly.map((totals) => (
                <div key={totals.month} className={styles.month}>
                  {(['income', 'spending'] as const).map((kind) => (
                    <i
                      key={kind}
                      // A month with none draws no bar, not even the outline's top edge.
                      className={`${styles.bar} ${styles[kind]} ${totals[kind] > 0 ? '' : styles.none}`}
                      data-testid="bar"
                      data-kind={kind}
                      style={{ blockSize: heightOf(display(totals[kind]), top) }}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className={styles.xAxis} aria-hidden="true">
              {monthly.map(({ month }) => (
                <span key={month} data-testid="x-label">
                  {formatMonthName(month, locale)}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
