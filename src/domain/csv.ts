// Reads a visitor's CSV of transactions (spec 8). Real exports are messy, so this is
// forgiving about layout (comma or semicolon, BOM, several date and amount styles) but
// strict about meaning: a cell it cannot read exactly is reported with its row number
// and the row is left out. It never guesses at a number. Pure: no React, no DOM and no
// File API. The caller reads the file and passes the text.

import Papa from 'papaparse'
import { CATEGORIES, categoriesFor } from './categories'
import { categorize } from './categorize'
import { CATEGORY_LABELS_EN } from './categoryLabels'
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

export interface CsvError {
  /**
   * Row number as a spreadsheet shows it, so the header is row 1. Row 0 means the file as
   * a whole (empty, no rows, too many rows). For `bad_quotes` it is the row where the
   * quote that never closes begins.
   */
  row: number
  code: CsvErrorCode
  /** The column the problem is in, by its canonical name: `date`, `amount`, `debit`, and so on. */
  column?: string
  /** What the cell held, trimmed and cut short, so the message can quote it. */
  value?: string
  /** Only for `bad_quotes`: how many non-blank lines after that row could not be read. */
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

/** Bengali digits ০ to ৯ as 0 to 9, so a Bengali-locale spreadsheet reads like any other. */
function toAsciiDigits(text: string): string {
  return text.replace(/[\u{9E6}-\u{9EF}]/gu, (digit) => String(digit.charCodeAt(0) - 0x09e6))
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

// A time of day after the date, as exports print it: 14:03, 14:03:22, 2:03 PM or
// 14:03:22+06:00. It is checked to be a real time and then dropped, because only the date
// is wanted. A zone is not applied either: the date is the one written, not the one it
// would be in UTC. Every group is non-capturing, so the date patterns keep their numbering.
const TIME_OF_DAY = [
  // 24-hour clock. Seconds may have a fraction, and a zone (Z, +06, +06:00 or +0600) may follow.
  String.raw`(?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)?`,
  // 12-hour clock. Hour 0 is let through because some systems count AM and PM hours from 0.
  String.raw`(?:0?\d|1[0-2]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?\s*[ap]m`,
].join('|')

// ISO joins its time with a T or a space (the T is also read in lower case, as RFC 3339 allows).
const ISO_DATE = new RegExp(
  String.raw`^(\d{4})-(\d{1,2})-(\d{1,2})(?:(?:T|\s+)(?:${TIME_OF_DAY}))?$`,
  'i',
)
// One separator, used twice: 31/10/2026, 31-10-2026 or 31.10.2026, never 31/10-2026.
const DAY_FIRST_DATE = new RegExp(
  String.raw`^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})(?:\s+(?:${TIME_OF_DAY}))?$`,
  'i',
)

function datePartsOf(text: string): [year: number, month: number, day: number] | null {
  const iso = ISO_DATE.exec(text)
  if (iso) {
    const [, year = '', month = '', day = ''] = iso
    return [Number(year), Number(month), Number(day)]
  }
  const dayFirst = DAY_FIRST_DATE.exec(text)
  if (dayFirst) {
    const [, day = '', , month = '', year = ''] = dayFirst
    return [Number(year), Number(month), Number(day)]
  }
  return null
}

/**
 * `YYYY-MM-DD`, or day first as `DD/MM/YYYY`, `DD-MM-YYYY` or `DD.MM.YYYY`, optionally
 * followed by a time of day (`31/10/2026 14:03`, `2026-10-31T14:03:22+06:00`), which is
 * ignored. A month-first date such as 10/31/2026 is not a date here, and neither is a
 * date followed by anything that is not a time. The result is always a real calendar date in
 * `YYYY-MM-DD` form, which is what the rest of the domain code expects.
 */
function parseDate(text: string): string | null {
  const parts = datePartsOf(toAsciiDigits(text))
  if (!parts) return null
  const [year, month, day] = parts
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  const pad = (value: number, length: number) => String(value).padStart(length, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

// The whole part is plain digits, Western groups (1,234,567) or lakh groups (12,34,567),
// which is how Bangladeshi banks print it. Anything else with a comma, such as 12,50, is
// more likely a decimal comma than a thousands separator. Reading it as 1250 would be
// silently wrong, so it is not a number here.
const NUMBER = /^(\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})+,\d{3})(\.\d+)?$/

/**
 * Reads an amount such as `1,234.50`, `(640)`, `৳ 1,240`, `১,২৪০` or `-$5`. Brackets mean
 * negative. Returns null for anything else, including an empty cell.
 */
function parseAmount(text: string): number | null {
  const cleaned = toAsciiDigits(text)
    .replace(/[৳$£€\s]/g, '')
    // The minus sign that word processors and some banks write.
    .replace(/\u{2212}/gu, '-')
  const bracketed = /^\((.*)\)$/.exec(cleaned)
  const unwrapped = bracketed ? (bracketed[1] ?? '') : cleaned

  const sign = /^[+-]/.exec(unwrapped)?.[0] ?? ''
  // (-640) says negative twice.
  if (bracketed && sign) return null

  const parts = NUMBER.exec(unwrapped.slice(sign.length))
  if (!parts) return null
  const [, whole = '', fraction = ''] = parts
  const value = Number(whole.replaceAll(',', '') + fraction)
  if (!Number.isFinite(value)) return null
  return sign === '-' || bracketed ? -value : value
}

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
}

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

  if (!date || !description || !amount) {
    const errors: CsvError[] = []
    if (!date) errors.push({ row, code: 'missing_column', column: 'date' })
    if (!description) errors.push({ row, code: 'missing_column', column: 'description' })
    if (!amount) errors.push({ row, code: 'missing_column', column: 'amount' })
    return { ok: false, errors }
  }
  return {
    ok: true,
    columns: { date, description, amount, currency: find('currency'), category: find('category') },
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

function readDate(cells: readonly string[], row: number, column: Column): string | CsvError {
  const text = cellText(cells, column)
  return parseDate(text) ?? cellError(row, 'bad_date', column, text)
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

function readRow(
  cells: readonly string[],
  row: number,
  columns: Columns,
  defaultCurrency: CurrencyCode,
): RowOutcome {
  const amount = readAmount(cells, row, columns.amount)
  // A zero amount, such as a balance enquiry, moves no money. It is not worth importing
  // and not worth an error, whatever else the row holds.
  if (amount === 0) return { kind: 'skipped' }

  const date = readDate(cells, row, columns.date)
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
 * The error for a quoted field that never closes. PapaParse gives up there and puts the
 * rest of the file, from just after the opening quote, into the last cell of the last
 * record. So that cell is what could not be read: its first line is the end of the row that
 * holds the quote, and each non-blank line after it is a row lost. A line of nothing but
 * delimiters is as blank here as it is everywhere else.
 */
function unclosedQuoteError(records: readonly (readonly string[])[], delimiter: string): CsvError {
  const unread = records.at(-1)?.at(-1) ?? ''
  const following = unread.split(/\r\n|\r|\n/).slice(1)
  const skippedRows = following.filter((line) => line.replaceAll(delimiter, '').trim() !== '')
  return { row: records.length, code: 'bad_quotes', skippedRows: skippedRows.length }
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
 * A quote that never closes hides everything after it, because the rest of the file reads
 * as one cell. The rows before it import. The row it starts in, and every row after, are
 * left out, and one `bad_quotes` error gives that row and how many lines were lost
 * (`skippedRows`). Only when the file cannot be used anyway (a missing column, too many
 * rows) is the quote not mentioned, as the visitor must fix the file first and will see it then.
 *
 * Each imported transaction has the id `row-<n>`, where n is its spreadsheet row.
 */
export function parseTransactionsCsv(text: string, defaultCurrency: CurrencyCode): ParseResult {
  // Excel's "CSV UTF-8" puts a byte-order mark first. PapaParse drops it too, but this way
  // nothing here depends on that.
  const content = text.replace(/^\u{FEFF}/u, '')

  // Blank lines are kept here and skipped below, so each record's position in the list is
  // its row in a spreadsheet. A quoted line break stays inside its record, as in a spreadsheet.
  const delimiter = detectDelimiter(content)
  const parsed = Papa.parse<string[]>(content, { delimiter, skipEmptyLines: false })

  // Of Papa's complaints only an unclosed quote matters. Papa stops there, so the record
  // holding it is the last one, with the rest of the file in its final cell. That record is
  // set aside and only the records before it are read. It is found by position, not by its
  // content, because a line of just `"` looks blank.
  const unclosedQuote = parsed.errors.some((error) => error.code === 'MissingQuotes')
    ? unclosedQuoteError(parsed.data, delimiter)
    : null
  const records = unclosedQuote ? parsed.data.slice(0, -1) : parsed.data

  const headerIndex = records.findIndex((cells) => !isBlank(cells))
  const header = records[headerIndex]
  // With nothing readable before an unclosed quote, the quote is in the header itself.
  if (header === undefined) return rejected(unclosedQuote ?? { row: 0, code: 'empty_file' })

  const parsedHeader = readHeader(header, headerIndex + 1)
  if (!parsedHeader.ok) return { transactions: [], errors: parsedHeader.errors }
  const { columns } = parsedHeader

  const dataRows: { row: number; cells: string[] }[] = []
  for (let index = headerIndex + 1; index < records.length; index++) {
    const cells = records[index]
    if (cells !== undefined && !isBlank(cells)) dataRows.push({ row: index + 1, cells })
  }
  // If the quote is in the first data row, the file has rows; they just cannot be read.
  if (dataRows.length === 0) return rejected(unclosedQuote ?? { row: 0, code: 'no_rows' })
  if (dataRows.length > MAX_ROWS) return rejected({ row: 0, code: 'too_many_rows' })

  const transactions: Transaction[] = []
  const errors: CsvError[] = []
  for (const { row, cells } of dataRows) {
    const outcome = readRow(cells, row, columns, defaultCurrency)
    if (outcome.kind === 'transaction') transactions.push(outcome.transaction)
    else if (outcome.kind === 'errors') errors.push(...outcome.errors)
  }
  // Last, as it is the highest row.
  if (unclosedQuote) errors.push(unclosedQuote)
  return { transactions, errors }
}
