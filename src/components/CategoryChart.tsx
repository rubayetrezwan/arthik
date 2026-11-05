import { useId } from 'react'
import { FormattedMessage } from 'react-intl'
import { CATEGORIES, groupOf } from '../domain/categories'
import type { Measures } from '../domain/measures'
import type { CategoryId } from '../domain/types'
import { useMoney } from '../hooks/useMoney'
import styles from './CategoryChart.module.css'

/** How a bar is drawn: needs filled, wants striped, the rest (cash, gifts, uncategorised) outlined. */
type Kind = 'need' | 'want' | 'other'

const KINDS: readonly Kind[] = ['need', 'want', 'other']

function kindOf(id: CategoryId): Kind {
  const group = groupOf(id)
  if (group === 'essential') return 'need'
  return group === 'want' ? 'want' : 'other'
}

/** Ties keep the order of the category table, so the list never shuffles. */
const TABLE_ORDER = new Map(CATEGORIES.map(({ id }, index) => [id, index]))

/**
 * Where the money goes: each spending category's monthly average as a horizontal bar,
 * biggest first. Wants are striped and say so in words; spending that is neither a need
 * nor a want (cash, gifts, uncategorised) is outlined.
 */
export function CategoryChart({ measures }: { measures: Measures }) {
  const money = useMoney()
  const titleId = useId()

  const rows = (Object.entries(measures.categoryMonthlyAvg) as [CategoryId, number][])
    .filter(([, average]) => average > 0)
    .sort(([a, x], [b, y]) => y - x || (TABLE_ORDER.get(a) ?? 0) - (TABLE_ORDER.get(b) ?? 0))
    .map(([id, average]) => ({ id, average, kind: kindOf(id) }))
  const biggest = rows[0]?.average
  if (biggest === undefined) return null

  const shown = new Set(rows.map(({ kind }) => kind))

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <FormattedMessage id="chart.categories.title" />
      </h3>
      <p className={styles.legend}>
        {KINDS.filter((kind) => shown.has(kind)).map((kind) => (
          <span key={kind} aria-hidden="true">
            <i className={`${styles.key} ${styles[kind]}`} />
            <FormattedMessage id={`chart.categories.${kind}`} />
          </span>
        ))}
        <span>
          <FormattedMessage id="chart.categories.average" />
        </span>
      </p>
      <ul className={styles.list} aria-labelledby={titleId}>
        {rows.map(({ id, average, kind }) => (
          <li key={id} className={styles.row}>
            <span className={styles.name}>
              <FormattedMessage id={`category.${id}`} />
              {kind !== 'need' && (
                <>
                  {' '}
                  <span className="visually-hidden">
                    <FormattedMessage id={`chart.categories.${kind}.label`} />
                  </span>
                </>
              )}
            </span>
            <span
              className={`${styles.bar} ${styles[kind]}`}
              data-kind={kind}
              style={{ inlineSize: `${(average / biggest) * 100}%` }}
              aria-hidden="true"
            />
            <span className={styles.amount}>{money(average)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
