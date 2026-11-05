import { useId, type ReactNode, type Ref } from 'react'
import { FormattedMessage } from 'react-intl'
import { MAX_ROWS, type CsvError, type CsvErrorCode } from '../domain/csv'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import type { LocaleCode } from '../i18n/locales'
import styles from './CsvErrors.module.css'
import { CSV_EXAMPLES } from './csvExamples'

/** How many problems are listed before the rest are only counted. */
const MAX_LISTED = 20

// Problems with the whole file or its header. The parser gives them row 0, or the header's row,
// and a row number would only mislead (R18).
const FILE_LEVEL: ReadonlySet<CsvErrorCode> = new Set<CsvErrorCode>([
  'empty_file',
  'no_rows',
  'too_many_rows',
  'month_first_dates',
  'missing_column',
  'duplicate_column',
  'direction_column',
])

interface Message {
  id: string
  values?: Record<string, ReactNode>
}

/** A column name or an example as the file has to write it: never translated. */
const column = (name: string) => <code>{name}</code>
/** Something the file wrote, kept apart from the sentence around it in right-to-left text. */
const quoted = (text: string) => <bdi>{text}</bdi>

const DATE_FORMS = { iso: column(CSV_EXAMPLES.isoDate), dayFirst: column(CSV_EXAMPLES.dayFirstDate) }
const MONEY_COLUMNS = {
  amount: column('amount'),
  debit: column('debit'),
  credit: column('credit'),
}

// One message per code, so a new code cannot reach the screen without words of its own.
const MESSAGES: Record<CsvErrorCode, (error: CsvError, locale: LocaleCode) => Message> = {
  empty_file: () => ({ id: 'upload.error.empty_file' }),
  no_rows: () => ({ id: 'upload.error.no_rows' }),
  too_many_rows: (_, locale) => ({
    id: 'upload.error.too_many_rows',
    values: { max: formatNumber(MAX_ROWS, locale) },
  }),
  month_first_dates: () => ({
    id: 'upload.error.month_first_dates',
    values: { monthFirst: column(CSV_EXAMPLES.monthFirstDate), ...DATE_FORMS },
  }),
  missing_column: ({ column: name = '' }) =>
    name === 'amount'
      ? { id: 'upload.error.missing_column.amount', values: MONEY_COLUMNS }
      : { id: 'upload.error.missing_column', values: { column: column(name) } },
  duplicate_column: ({ column: name = '' }) => {
    // For two names of one column, the parser gives the second name as the file wrote it.
    const key = name.toLowerCase()
    if (key === 'debit' || key === 'withdrawal') {
      return {
        id: 'upload.error.duplicate_column.debit',
        values: { debit: column('debit'), withdrawal: column('withdrawal') },
      }
    }
    if (key === 'credit' || key === 'deposit') {
      return {
        id: 'upload.error.duplicate_column.credit',
        values: { credit: column('credit'), deposit: column('deposit') },
      }
    }
    return { id: 'upload.error.duplicate_column', values: { column: column(key) } }
  },
  direction_column: ({ column: name }) =>
    name
      ? { id: 'upload.error.direction_column', values: { column: quoted(name), ...MONEY_COLUMNS } }
      : { id: 'upload.error.direction_column.unnamed', values: MONEY_COLUMNS },
  bad_date: ({ value = '' }) =>
    value === ''
      ? { id: 'upload.error.bad_date.empty' }
      : { id: 'upload.error.bad_date', values: { value: quoted(value), ...DATE_FORMS } },
  bad_amount: ({ value = '', column: name = 'amount' }) =>
    value === ''
      ? { id: 'upload.error.bad_amount.empty' }
      : name === 'amount'
        ? {
            id: 'upload.error.bad_amount',
            values: { value: quoted(value), example: column(CSV_EXAMPLES.moneyOut) },
          }
        : {
            id: 'upload.error.bad_amount.pair',
            values: { value: quoted(value), column: column(name) },
          },
  bad_currency: ({ value = '' }) => ({
    id: 'upload.error.bad_currency',
    values: { value: quoted(value) },
  }),
  bad_category: ({ value = '' }) => ({
    id: 'upload.error.bad_category',
    values: { value: quoted(value) },
  }),
  bad_quotes: ({ skippedRows = 0 }) => ({
    id: 'upload.error.bad_quotes',
    values: { lines: skippedRows },
  }),
  extra_cells: () => ({ id: 'upload.error.extra_cells' }),
}

/**
 * The problems to list: the first `MAX_LISTED`, then the first one of each kind not among them,
 * so every kind of problem in the file is named at least once.
 */
function toList(errors: readonly CsvError[]): CsvError[] {
  const listed = errors.slice(0, MAX_LISTED)
  const kinds = new Set(listed.map((error) => error.code))
  for (const error of errors.slice(MAX_LISTED)) {
    if (kinds.has(error.code)) continue
    kinds.add(error.code)
    listed.push(error)
  }
  return listed
}

interface CsvErrorsProps {
  errors: readonly CsvError[]
  /** How many rows could be read, and would be used on continuing. */
  validCount: number
  onContinue(): void
  summaryRef: Ref<HTMLElement>
}

/**
 * What the reader could not use in a file, listed with row numbers, and the choice to go on
 * with the rows it could read. The page moves focus here when it appears.
 */
export function CsvErrors({ errors, validCount, onContinue, summaryRef }: CsvErrorsProps) {
  const locale = useLocale()
  const titleId = useId()
  const listed = toList(errors)
  const unlisted = errors.length - listed.length

  return (
    <section
      ref={summaryRef}
      role="alert"
      aria-labelledby={titleId}
      tabIndex={-1}
      className={styles.summary}
    >
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id={validCount > 0 ? 'upload.errors.title.some' : 'upload.errors.title'} />
      </h2>
      <p>
        <FormattedMessage
          id={validCount > 0 ? 'upload.errors.fixOrContinue' : 'upload.errors.fix'}
        />
      </p>
      <ul className={styles.list}>
        {listed.map((error, index) => {
          const { id, values } = MESSAGES[error.code](error, locale)
          const problem = <FormattedMessage id={id} values={values} />
          return (
            <li key={index}>
              {FILE_LEVEL.has(error.code) ? (
                problem
              ) : (
                <FormattedMessage
                  id="upload.errors.row"
                  values={{
                    row: formatNumber(error.row, locale),
                    problem,
                    b: (chunks: ReactNode[]) => <b className={styles.row}>{chunks}</b>,
                  }}
                />
              )}
            </li>
          )
        })}
      </ul>
      {unlisted > 0 && (
        <p className={styles.more}>
          <FormattedMessage id="upload.errors.more" values={{ count: unlisted }} />
        </p>
      )}
      {validCount > 0 && (
        <button type="button" className={styles.continue} onClick={onContinue}>
          <FormattedMessage id="upload.errors.continue" values={{ count: validCount }} />
        </button>
      )}
    </section>
  )
}
