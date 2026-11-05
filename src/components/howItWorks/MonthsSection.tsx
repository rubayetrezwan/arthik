import { FormattedMessage } from 'react-intl'
import { completeMonths, EDGE_DAYS, MAX_MONTHS, monthOf } from '../../domain/period'
import { formatFullDate, formatMonth, formatMonthRange, formatNumber } from '../../i18n/format'
import { useLocale } from '../../i18n/I18nProvider'
import styles from './Method.module.css'
import { MethodSection } from './MethodSection'

/** Made-up first and last transaction dates. The months they give are worked out by the real rule. */
const EXAMPLE_FIRST = '2026-05-12'
const EXAMPLE_LAST = '2026-10-27'

/** The complete-month rule, from EDGE_DAYS and MAX_MONTHS, with one worked example. */
export function MonthsSection() {
  const locale = useLocale()
  const days = formatNumber(EDGE_DAYS, locale)

  const months = completeMonths([EXAMPLE_FIRST, EXAMPLE_LAST])
  const used = months.length > 0 ? formatMonthRange(months[0] ?? '', months.at(-1) ?? '', locale) : ''
  // Said only when the rule really did leave that month out.
  const firstMonth = monthOf(EXAMPLE_FIRST)
  const lastMonth = monthOf(EXAMPLE_LAST)
  const firstLeftOut = !months.includes(firstMonth)
  const lastLeftOut = !months.includes(lastMonth)

  return (
    <MethodSection titleId="howItWorks.months.title">
      <p className={styles.intro}>
        <FormattedMessage
          id="howItWorks.months.intro"
          values={{ max: formatNumber(MAX_MONTHS, locale) }}
        />
      </p>
      <ul className={styles.list}>
        <li>
          <FormattedMessage id="howItWorks.months.between" />
        </li>
        <li>
          <FormattedMessage id="howItWorks.months.first" values={{ days }} />
        </li>
        <li>
          <FormattedMessage id="howItWorks.months.last" values={{ days }} />
        </li>
      </ul>
      <p className={`${styles.prose} ${styles.intro}`}>
        <FormattedMessage
          id="howItWorks.months.example"
          values={{
            first: formatFullDate(EXAMPLE_FIRST, locale),
            last: formatFullDate(EXAMPLE_LAST, locale),
            range: used,
          }}
        />
        {firstLeftOut && (
          <>
            {' '}
            <FormattedMessage
              id="howItWorks.months.firstLeftOut"
              values={{ month: formatMonth(firstMonth, locale), days }}
            />
          </>
        )}
        {lastLeftOut && (
          <>
            {' '}
            <FormattedMessage
              id="howItWorks.months.lastLeftOut"
              values={{ month: formatMonth(lastMonth, locale), days }}
            />
          </>
        )}
      </p>
      <p className={`${styles.intro} ${styles.note}`}>
        <FormattedMessage id="howItWorks.months.shown" />
      </p>
    </MethodSection>
  )
}
