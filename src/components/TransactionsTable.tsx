import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import type { CategoryId, Transaction } from '../domain/types'
import { useMoney } from '../hooks/useMoney'
import { formatDate, formatMoney, formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { usePrefs } from '../state/prefs'
import { CategorySelect } from './CategorySelect'
import styles from './TransactionsTable.module.css'

interface TransactionsTableProps {
  transactions: readonly Transaction[]
  /** Called when the visitor gives a transaction another category. */
  onCategoryChange(txId: string, category: CategoryId): void
}

/** How many rows are shown at first, and how many more each "Show more" adds. */
const PAGE = 20

/** Newest first. Lines on the same day keep the file's order, the latest line first. */
function newestFirst(transactions: readonly Transaction[]): Transaction[] {
  return transactions
    .map((transaction, index) => ({ transaction, index }))
    .sort((a, b) =>
      a.transaction.date === b.transaction.date
        ? b.index - a.index
        : a.transaction.date < b.transaction.date
          ? 1
          : -1,
    )
    .map(({ transaction }) => transaction)
}

function TransactionRow({
  transaction,
  onCategoryChange,
}: {
  transaction: Transaction
  onCategoryChange: TransactionsTableProps['onCategoryChange']
}) {
  const intl = useIntl()
  const locale = useLocale()
  const money = useMoney()
  const { currency } = usePrefs()
  const flagId = useId()
  const { id, date, description, amount, category, unrecognisedIncome } = transaction
  const incoming = amount > 0

  return (
    <tr role="row">
      <td role="cell" className={styles.date}>
        <time dateTime={date}>{formatDate(date, locale)}</time>
      </td>
      <td role="cell" className={styles.description}>{description}</td>
      <td role="cell" className={styles.category}>
        <CategorySelect
          value={category}
          direction={incoming ? 'in' : 'out'}
          label={intl.formatMessage({ id: 'transactions.categoryFor' }, { description })}
          onChange={(chosen) => onCategoryChange(id, chosen)}
          describedBy={unrecognisedIncome ? flagId : undefined}
        />
        {unrecognisedIncome && (
          <p id={flagId} className={styles.flag}>
            <FormattedMessage id="transactions.unrecognised" />
          </p>
        )}
      </td>
      <td role="cell" className={`${styles.amount} ${incoming ? styles.in : ''}`}>
        <bdi>{money(amount, transaction.currency, { signed: true })}</bdi>
        {transaction.currency !== currency && (
          <span className={styles.original}>
            <FormattedMessage
              id="transactions.original"
              values={{
                amount: (
                  <bdi>
                    {formatMoney(amount, transaction.currency, locale, {
                      signed: true,
                      keepTiny: true,
                    })}
                  </bdi>
                ),
              }}
            />
          </span>
        )}
      </td>
    </tr>
  )
}

/**
 * Every transaction in the file, newest first, a page at a time. Each category can be
 * changed, and the score is worked out again from the change.
 */
export function TransactionsTable({ transactions, onCategoryChange }: TransactionsTableProps) {
  const locale = useLocale()
  const titleId = useId()
  const [shown, setShown] = useState(PAGE)
  const rows = useMemo(() => newestFirst(transactions), [transactions])
  const body = useRef<HTMLTableSectionElement>(null)
  // The first row "Show more" revealed, which takes the focus once it is on screen.
  const firstNew = useRef<number | null>(null)

  useEffect(() => {
    if (firstNew.current === null) return
    body.current?.rows[firstNew.current]?.querySelector('select')?.focus()
    firstNew.current = null
  }, [shown])

  const visible = rows.slice(0, shown)

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <FormattedMessage id="transactions.title" />
      </h3>
      <p className={styles.note}>
        <FormattedMessage id="transactions.note" />
      </p>

      <table role="table" className={styles.table} aria-labelledby={titleId}>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col">
              <FormattedMessage id="transactions.date" />
            </th>
            <th role="columnheader" scope="col">
              <FormattedMessage id="transactions.description" />
            </th>
            <th role="columnheader" scope="col">
              <FormattedMessage id="transactions.category" />
            </th>
            <th role="columnheader" scope="col" className={styles.end}>
              <FormattedMessage id="transactions.amount" />
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" ref={body}>
          {visible.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </tbody>
      </table>

      <div className={styles.more}>
        <p className={styles.count}>
          <FormattedMessage
            id="transactions.shown"
            values={{ shown: formatNumber(visible.length, locale), total: rows.length }}
          />
        </p>
        {visible.length < rows.length && (
          <button
            type="button"
            className={styles.showMore}
            onClick={() => {
              firstNew.current = visible.length
              setShown((count) => count + PAGE)
            }}
          >
            <FormattedMessage id="transactions.showMore" />
          </button>
        )}
      </div>
    </section>
  )
}
