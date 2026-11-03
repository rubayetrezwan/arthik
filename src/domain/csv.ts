// Reads a visitor's CSV of transactions (spec 8). Real exports are messy, so this is
// forgiving about layout (comma or semicolon, BOM, several date and amount styles) but
// strict about meaning: a cell it cannot read exactly is reported with its row number
// and the row is left out. It never guesses at a number. Pure: no React, no DOM and no
// File API. The caller reads the file and passes the text.

import Papa, { type ParseError } from 'papaparse'
import { CATEGORIES, categoriesFor } from './categories'
import { categorize } from './categorize'
import { CATEGORY_LABELS_EN } from './categoryLabels'
import { parseAmount, readDateCell } from './csvCells'
import { CURRENCY_CODES, type CategoryId, type CurrencyCode, type Transaction } from './types'

export type CsvErrorCode =
  | 'empty_file'
  | 'no_rows'
  | 'missing_column'
  | 'bad_date'
  | 'bad_amount'
  | 'bad_currency'
  | 'bad_category'
  | 'bad_quotes'
  | 'too_many_rows'
  /** A row has more cells than the header: an unquoted comma in an amount or description shifted its cells. */
  | 'extra_cells'
  /** The file writes dates month first (a date such as 10/31/2026), so dates that could be read either way are rejected. */
  | 'month_first_dates'
  /** The file has an amount column and a column that says debit or credit, so the sign of the amount cannot be told. */
  | 'direction_column'

export interface CsvError {
  /**
   * Row number as a spreadsheet shows it, so the header is row 1. Row 0 means the file as
   * a whole (empty, no rows, too many rows, month-first dates); a problem with a header is
   * on the header's row. For `bad_quotes` it is the row where the
   * broken record begins.
   */
  row: number
  code: CsvErrorCode
  /**
   * The column the problem is in, by its canonical name: `date`, `amount`, `debit`, and so on.
   * For `direction_column` it is the header as the file wrote it, trimmed (`DR/CR`).
   */
  column?: string
  /** What the cell held, trimmed and cut short, so the message can quote it. */
  value?: string
  /**
   * Only for `bad_quotes`: how many non-blank lines after the first one that record ran
   * over, because its quote swallowed them. 0 when it stayed on its own line.
   */
  skippedRows?: number
}

export interface ParseResult {
  transactions: Transaction[]
  errors: CsvError[]
}

/** Data rows allowed in one file. Blank lines do not count. */
export const MAX_ROWS = 20000

/** How much of a bad cell an error keeps. */
const MAX_SHOWN_LENGTH = 40

// ---------------------------------------------------------------------------
// Reading single cells
// ---------------------------------------------------------------------------

function isCurrencyCode(code: string): code is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(code)
}

function nameKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

// A category cell may hold an id (`eating_out`) or the English name (`Eating out & delivery`).
const CATEGORY_BY_NAME = new Map<string, CategoryId>()
for (const { id } of CATEGORIES) {
  CATEGORY_BY_NAME.set(nameKey(id), id)
  CATEGORY_BY_NAME.set(nameKey(CATEGORY_LABELS_EN[id]), id)
}

const CATEGORIES_FOR_MONEY_IN: ReadonlySet<CategoryId> = new Set(categoriesFor('in'))
const CATEGORIES_FOR_MONEY_OUT: ReadonlySet<CategoryId> = new Set(categoriesFor('out'))

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

interface Column {
  index: number
  /** The header text, trimmed and lower-cased. */
  name: string
}

type AmountColumns =
  | { kind: 'signed'; amount: Column }
  // The amount is what came in minus what went out.
  | { kind: 'split'; debit: Column; credit: Column }

interface Columns {
  date: Column
  description: Column
  amount: AmountColumns
  currency: Column | null
  category: Column | null
  /**
   * How many cells a row may fill: up to the last header with a name. Spreadsheets pad every
   * line with empty cells to the widest one, so a header can end in empty cells that are
   * padding and not columns.
   */
  width: number
}

// Headers that say which way the money went. Next to a single `amount` column, they leave it open
// whether the amount carries its own sign or is a size to be signed by this column. Compared
// after `nameKey`, so case and spaces do not matter.
const DIRECTION_COLUMNS: ReadonlySet<string> = new Set([
  'type',
  'dr/cr',
  'drcr',
  'dr_cr',
  'transaction type',
  'debit/credit',
])

function readHeader(
  cells: readonly string[],
  row: number,
): { ok: true; columns: Columns } | { ok: false; errors: CsvError[] } {
  const names = cells.map(nameKey)
  const find = (...candidates: string[]): Column | null => {
    for (const name of candidates) {
      const index = names.indexOf(name)
      if (index !== -1) return { index, name }
    }
    return null
  }

  const date = find('date')
  const description = find('description')
  const signed = find('amount')
  const debit = find('debit', 'withdrawal')
  const credit = find('credit', 'deposit')
  // One half of a pair is not enough to tell money in from money out.
  const amount: AmountColumns | null = signed
    ? { kind: 'signed', amount: signed }
    : debit && credit
      ? { kind: 'split', debit, credit }
      : null

  const errors: CsvError[] = []
  if (!date) errors.push({ row, code: 'missing_column', column: 'date' })
  if (!description) errors.push({ row, code: 'missing_column', column: 'description' })
  if (!amount) errors.push({ row, code: 'missing_column', column: 'amount' })
  if (signed) {
    // A signed amount next to a column that says debit or credit: the sign may be in either.
    names.forEach((name, index) => {
      if (DIRECTION_COLUMNS.has(name)) {
        errors.push({ row, code: 'direction_column', column: (cells[index] ?? '').trim() })
      }
    })
  }
  if (errors.length > 0 || !date || !description || !amount) return { ok: false, errors }
  const lastNamed = names.findLastIndex((name) => name !== '')
  return {
    ok: true,
    columns: {
      date,
      description,
      amount,
      currency: find('currency'),
      category: find('category'),
      width: lastNamed + 1,
    },
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function cellText(cells: readonly string[], column: Column): string {
  return (cells[column.index] ?? '').trim()
}

function cellError(row: number, code: CsvErrorCode, column: Column, text: string): CsvError {
  const value = text.length > MAX_SHOWN_LENGTH ? `${text.slice(0, MAX_SHOWN_LENGTH)}…` : text
  return { row, code, column: column.name, value }
}

function isCsvError(value: unknown): value is CsvError {
  return typeof value === 'object' && value !== null && 'code' in value
}

/**
 * A date such as 10/05/2026 is read day first, unless the file has shown that it writes month
 * first (`monthFirstFile`). Then it could be either, and it is not read at all.
 */
function readDate(
  cells: readonly string[],
  row: number,
  column: Column,
  monthFirstFile: boolean,
): string | CsvError {
  const text = cellText(cells, column)
  const { date, ambiguous } = readDateCell(text)
  return date === null || (monthFirstFile && ambiguous)
    ? cellError(row, 'bad_date', column, text)
    : date
}

/** The amount of a row, signed (money in is positive). */
function readAmount(
  cells: readonly string[],
  row: number,
  columns: AmountColumns,
): number | CsvError {
  if (columns.kind === 'signed') {
    const text = cellText(cells, columns.amount)
    return parseAmount(text) ?? cellError(row, 'bad_amount', columns.amount, text)
  }

  const debitText = cellText(cells, columns.debit)
  const creditText = cellText(cells, columns.credit)
  // A row with neither is not a payment we can read, and not one we can call zero.
  if (debitText === '' && creditText === '') {
    return cellError(row, 'bad_amount', columns.debit, '')
  }

  // A bank puts the size of the payment in one column and leaves the other empty. The
  // column already says which way the money went, so a sign here would contradict it.
  let debit = 0
  if (debitText !== '') {
    const value = parseAmount(debitText)
    if (value === null || value < 0) return cellError(row, 'bad_amount', columns.debit, debitText)
    debit = value
  }
  let credit = 0
  if (creditText !== '') {
    const value = parseAmount(creditText)
    if (value === null || value < 0) return cellError(row, 'bad_amount', columns.credit, creditText)
    credit = value
  }

  if (debit !== 0 && credit !== 0) {
    // Both filled is unusual. Round to cents so 4000.1 - 640.2 is not 3359.8999999999996.
    return Math.round((credit - debit) * 100) / 100
  }
  return credit - debit
}

/** An empty cell, or no currency column at all, means the currency the visitor chose. */
function readCurrency(
  cells: readonly string[],
  row: number,
  column: Column | null,
  fallback: CurrencyCode,
): CurrencyCode | CsvError {
  const text = column ? cellText(cells, column) : ''
  if (column === null || text === '') return fallback
  const code = text.toUpperCase()
  return isCurrencyCode(code) ? code : cellError(row, 'bad_currency', column, text)
}

interface ReadCategory {
  category: CategoryId
  /** True when money in matched nothing and was counted as other income. */
  unrecognisedIncome: boolean
}

/**
 * The category a cell names, if it fits the direction of the money, else what the
 * categoriser makes of the description. `amount` is not zero.
 */
function readCategory(
  cells: readonly string[],
  row: number,
  column: Column | null,
  description: string,
  amount: number,
): ReadCategory | CsvError {
  const text = column ? cellText(cells, column) : ''
  if (column === null || text === '') return categorize(description, amount)

  const category = CATEGORY_BY_NAME.get(nameKey(text))
  const allowed = amount > 0 ? CATEGORIES_FOR_MONEY_IN : CATEGORIES_FOR_MONEY_OUT
  if (category === undefined || !allowed.has(category)) {
    return cellError(row, 'bad_category', column, text)
  }
  // The visitor chose this, so there is nothing for them to check.
  return { category, unrecognisedIncome: false }
}

type RowOutcome =
  | { kind: 'transaction'; transaction: Transaction }
  | { kind: 'skipped' }
  | { kind: 'errors'; errors: CsvError[] }

/**
 * Whether a row runs past the header in a way that means its cells are not where the header
 * says. A comma inside an unquoted cell, as in 55,000 or "Flat 5, 300", cuts the cell in two and
 * pushes every cell after it one place right, so an amount can be read as 55 with the 000
 * left over. Empty cells after the last column are fine; spreadsheets add them.
 *
 * One case hides behind those empty cells. In a debit and credit file the empty credit cell is
 * what gets pushed off the end, so 18,000 in the debit column makes a row with a debit of 18,
 * a credit of 000 and nothing extra. A row that runs past the header and fills both money
 * columns is therefore not trusted either. (Both filled is unusual anyway.)
 */
function hasExtraCells(cells: readonly string[], columns: Columns): boolean {
  const extra = cells.slice(columns.width)
  if (extra.some((cell) => cell.trim() !== '')) return true
  return (
    extra.length > 0 &&
    columns.amount.kind === 'split' &&
    cellText(cells, columns.amount.debit) !== '' &&
    cellText(cells, columns.amount.credit) !== ''
  )
}

function readRow(
  cells: readonly string[],
  row: number,
  columns: Columns,
  defaultCurrency: CurrencyCode,
  monthFirstFile: boolean,
): RowOutcome {
  // Nothing in a row that does not line up with the header can be trusted, so it is checked
  // before anything else, and nothing else about the row is reported.
  if (hasExtraCells(cells, columns)) return { kind: 'errors', errors: [{ row, code: 'extra_cells' }] }

  const amount = readAmount(cells, row, columns.amount)
  // A zero amount, such as a balance enquiry, moves no money. It is not worth importing
  // and not worth an error, whatever else the row holds.
  if (amount === 0) return { kind: 'skipped' }

  const date = readDate(cells, row, columns.date, monthFirstFile)
  const currency = readCurrency(cells, row, columns.currency, defaultCurrency)
  const description = cellText(cells, columns.description)
  // The category has to fit the direction of the money, so it waits for a readable amount.
  const category = isCsvError(amount)
    ? null
    : readCategory(cells, row, columns.category, description, amount)

  if (
    isCsvError(date) ||
    isCsvError(amount) ||
    isCsvError(currency) ||
    category === null ||
    isCsvError(category)
  ) {
    // Whichever of these failed is an error; the ones that read fine are filtered out.
    return { kind: 'errors', errors: [date, amount, currency, category].filter(isCsvError) }
  }

  const transaction: Transaction = {
    id: `row-${row}`,
    date,
    description,
    amount,
    currency,
    category: category.category,
  }
  if (category.unrecognisedIncome) transaction.unrecognisedIncome = true
  return { kind: 'transaction', transaction }
}

// ---------------------------------------------------------------------------
// File
// ---------------------------------------------------------------------------

/** Comma or semicolon, whichever the file uses (semicolons are common where a comma is the decimal mark). */
function detectDelimiter(text: string): ',' | ';' {
  // Blank lines would count as one-column rows and could hide the pattern, so the probe
  // skips them. Only the delimiter is wanted, hence a preview of a single row.
  const probe = Papa.parse<string[]>(text, {
    preview: 1,
    newline: '\n',
    skipEmptyLines: 'greedy',
    delimiter: '',
    delimitersToGuess: [',', ';'],
  })
  return probe.meta.delimiter === ';' ? ';' : ','
}

function isBlank(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim() === '')
}

function rejected(error: CsvError): ParseResult {
  return { transactions: [], errors: [error] }
}

/**
 * How many non-blank lines a record ran over. A quoted cell may hold line breaks, so a
 * record that took in lines it should not have shows them as line breaks inside its cells:
 * the first line of the record is where it began, and each non-blank line after that, in any
 * cell, is one it swallowed. A line of nothing but delimiters is as blank here as it is
 * everywhere else.
 */
function linesSwallowed(cells: readonly string[], delimiter: string): number {
  let count = 0
  for (const cell of cells) {
    for (const line of cell.split('\n').slice(1)) {
      if (line.replaceAll(delimiter, '').trim() !== '') count++
    }
  }
  return count
}

/**
 * The records whose quotes PapaParse could not make sense of, keyed by their position in
 * `records`, each with its `bad_quotes` error. There are two ways a quote goes wrong:
 *
 * - `MissingQuotes`: a quote opens and never closes. PapaParse gives up there, so the rest of
 *   the file is inside the last record.
 * - `InvalidQuotes`: a quote is followed by something that is not a delimiter or a line end,
 *   as with a stray quote that a later, good quote then closes by accident. PapaParse carries
 *   on looking for a closing quote, so the record is still returned, with lines it should not
 *   have taken in and cells that are not what the file meant.
 *
 * Either way the record cannot be trusted: its date, description and amount may be from
 * different rows. One record can draw several complaints (a bad quote that no later quote
 * closes draws both kinds), so it gets one error. The position is PapaParse's own `row`,
 * which is the index into `records` because blank lines are not skipped. The position is
 * used and not the content, because a line of just `"` looks blank.
 */
function brokenQuoteRecords(
  records: readonly (readonly string[])[],
  complaints: readonly ParseError[],
  delimiter: string,
): Map<number, CsvError> {
  const broken = new Map<number, CsvError>()
  for (const complaint of complaints) {
    if (complaint.type !== 'Quotes') continue
    // PapaParse always names the row. If it ever did not, the last record is where
    // PapaParse stops, and a wrongly placed error is better than a silently wrong number.
    const index = complaint.row ?? records.length - 1
    if (broken.has(index)) continue
    const cells = records[index] ?? []
    broken.set(index, {
      row: index + 1,
      code: 'bad_quotes',
      skippedRows: linesSwallowed(cells, delimiter),
    })
  }
  return broken
}

/**
 * Whether a record has swallowed one or more rows that start with a date. This is a third way
 * a quote goes wrong, and PapaParse reports nothing for it: a stray quote opens a field, and the
 * next quote that stands just before a delimiter or a line end closes it, as in
 *
 *     2026-10-02,"Eid shopping,-7
 *     2026-10-03,Monitor 24",-8
 *
 * where the quote after 24 is the one that is taken for the end of the field. The record is the
 * date 2026-10-02, a description with a line break in it, and the amount -8: the -7 and the
 * row of 2026-10-03 are gone and nothing says so. A real note with a line break in it does not
 * begin its second line with a date and a delimiter, which is what a row looks like.
 *
 * It finds the rows by their dates, and only when the date is first on its line, so a row
 * whose date is further along is not found.
 */
function swallowsDatedRow(cells: readonly string[], delimiter: string): boolean {
  return cells.some(
    (cell) =>
      cell.includes('\n') &&
      cell
        .split('\n')
        .slice(1)
        .some((line) => {
          const end = line.indexOf(delimiter)
          if (end === -1) return false
          const { date, monthFirstOnly } = readDateCell(line.slice(0, end).trim())
          return date !== null || monthFirstOnly
        }),
  )
}

/**
 * Reads transactions from CSV text.
 *
 * The file needs `date`, `description` and either a signed `amount` or a `debit`/`credit`
 * (or `withdrawal`/`deposit`) pair; `currency` and `category` are optional. Rows that
 * cannot be read are left out and reported with their spreadsheet row number, and the rest
 * still import. A file that cannot be used at all (empty, no rows, a missing column, over
 * `MAX_ROWS`) gives no transactions and says why.
 *
 * A broken quote makes PapaParse merge lines into one record, so the cells of that record
 * may come from different rows and cannot be trusted. Such a record is never imported. It is
 * reported by one `bad_quotes` error giving the row it starts in and how many further lines it
 * swallowed (`skippedRows`). A quote that never closes swallows everything after it; a stray
 * quote closed by accident by a later one swallows only the lines in between, and the rows
 * after that import as usual. A stray quote that a later quote closes at the end of a field
 * looks fine to PapaParse, so it is found another way: a line inside a quoted cell that starts
 * with a date and a delimiter is a row that was swallowed. The row numbers after a merged record
 * count it as one row, the way a spreadsheet shows it. Only when the file cannot be used anyway
 * (a missing column, too many rows) is a broken quote not mentioned, as the visitor must fix
 * the file first and will see it then. A broken quote in the header is reported alone, because
 * the header cannot be read.
 *
 * Each imported transaction has the id `row-<n>`, where n is its spreadsheet row.
 */
export function parseTransactionsCsv(text: string, defaultCurrency: CurrencyCode): ParseResult {
  // Excel's "CSV UTF-8" puts a byte-order mark first. PapaParse drops it too, but this way
  // nothing here depends on that. Line endings are made the same everywhere as well: PapaParse
  // takes the ending from the first line, so a CRLF header over LF rows would otherwise be read
  // with the rows joined into one record. Both passes below then name the ending, and nothing
  // after this has to allow for a CR.
  const content = text.replace(/^\u{FEFF}/u, '').replace(/\r\n?/g, '\n')

  // Blank lines are kept here and skipped below, so each record's position in the list is
  // its row in a spreadsheet. A quoted line break stays inside its record, as in a spreadsheet.
  const delimiter = detectDelimiter(content)
  const { data: records, errors: complaints } = Papa.parse<string[]>(content, {
    delimiter,
    newline: '\n',
    skipEmptyLines: false,
  })
  const brokenQuotes = brokenQuoteRecords(records, complaints, delimiter)

  // The header is the first record with anything in it. A broken record counts as having
  // something, whatever it looks like.
  const headerIndex = records.findIndex(
    (cells, index) => brokenQuotes.has(index) || !isBlank(cells),
  )
  const header = records[headerIndex]
  if (header === undefined) return rejected({ row: 0, code: 'empty_file' })
  const brokenHeader = brokenQuotes.get(headerIndex)
  if (brokenHeader) return rejected(brokenHeader)

  const parsedHeader = readHeader(header, headerIndex + 1)
  if (!parsedHeader.ok) return { transactions: [], errors: parsedHeader.errors }
  const { columns } = parsedHeader

  const dataRows: { row: number; cells: string[] }[] = []
  for (let index = headerIndex + 1; index < records.length; index++) {
    const cells = records[index]
    // A broken record is reported, not read.
    if (cells === undefined || brokenQuotes.has(index) || isBlank(cells)) continue
    if (swallowsDatedRow(cells, delimiter)) {
      brokenQuotes.set(index, {
        row: index + 1,
        code: 'bad_quotes',
        skippedRows: linesSwallowed(cells, delimiter),
      })
      continue
    }
    dataRows.push({ row: index + 1, cells })
  }
  // PapaParse's complaints came first, so the ones found just now are out of row order.
  const quoteErrors = [...brokenQuotes.values()].sort((a, b) => a.row - b.row)
  if (dataRows.length === 0) {
    // If the only data rows are broken, the file has rows; they just cannot be read.
    return quoteErrors.length > 0
      ? { transactions: [], errors: quoteErrors }
      : rejected({ row: 0, code: 'no_rows' })
  }
  if (dataRows.length > MAX_ROWS) return rejected({ row: 0, code: 'too_many_rows' })

  // One date that can only be month first (10/31/2026) shows how the whole file writes its
  // dates. Every row counts, even one that is skipped or has another problem, because the date
  // is still what the file wrote.
  const monthFirstFile = dataRows.some(
    ({ cells }) => readDateCell(cellText(cells, columns.date)).monthFirstOnly,
  )

  const transactions: Transaction[] = []
  const errors: CsvError[] = []
  if (monthFirstFile) errors.push({ row: 0, code: 'month_first_dates' })
  for (const { row, cells } of dataRows) {
    const outcome = readRow(cells, row, columns, defaultCurrency, monthFirstFile)
    if (outcome.kind === 'transaction') transactions.push(outcome.transaction)
    else if (outcome.kind === 'errors') errors.push(...outcome.errors)
  }
  // Back into row order. The sort is stable, so the errors of one row stay in column order.
  errors.push(...quoteErrors)
  errors.sort((a, b) => a.row - b.row)
  return { transactions, errors }
}
