// Number, money and date formatting for every screen. All functions return display
// strings. A minus is always U+2212 (the true minus sign), never a hyphen, and a number
// that is NaN or infinite is shown as an em dash.
//
// What was verified about `Intl` (spec 7.3), and what this file does about it:
// - `en-BD` has no lakh grouping, so English taka use `en-IN` grouping.
// - `bn-BD` gives lakh grouping and Bengali digits but puts ৳ after the number. Arthik
//   puts it in front, as bKash and other Bangladeshi apps do.
// - `hi-IN` already gives ৳1,50,000.
// - `ar` gives Western digits with direction marks around them. Those marks are kept.

import type { CurrencyCode } from '../domain/types'
import { LOCALES, type LocaleCode } from './locales'

const MINUS = '\u2212'

/**
 * Shown instead of NaN or infinity, so "NaN" and "\u221e" can never reach the screen, and
 * wherever a figure has no value, such as the points of a measure that is not scored.
 */
export const NO_VALUE = '\u2014'

/** Taka and yen are shown in whole units. Every other currency shows two decimals. */
const WHOLE_UNIT_CURRENCIES: ReadonlySet<CurrencyCode> = new Set(['BDT', 'JPY'])

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const numberFormats = new Map<string, Intl.NumberFormat>()

/** Building an `Intl.NumberFormat` is slow, and a dashboard formats hundreds of numbers. */
function numberFormat(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${tag} ${JSON.stringify(options)}`
  let format = numberFormats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(tag, options)
    numberFormats.set(key, format)
  }
  return format
}

function isSign(part: Intl.NumberFormatPart): boolean {
  return part.type === 'minusSign' || part.type === 'plusSign'
}

function toText(parts: Intl.NumberFormatPart[]): string {
  // Only the hyphen inside the sign is swapped: Arabic puts direction marks next to it.
  return parts
    .map((part) => (part.type === 'minusSign' ? part.value.replace('-', MINUS) : part.value))
    .join('')
}

/** Moves the currency symbol in front of the digits, keeping any sign in front of both. */
function symbolFirst(parts: Intl.NumberFormatPart[]): string {
  const signs = parts.filter(isSign)
  const symbols = parts.filter((part) => part.type === 'currency')
  const digits = parts.filter((part) => !isSign(part) && part.type !== 'currency')
  return toText([...signs, ...symbols, ...digits])
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: LocaleCode,
  opts: { signed?: boolean } = {},
): string {
  if (!Number.isFinite(amount)) return NO_VALUE

  const decimals = WHOLE_UNIT_CURRENCIES.has(currency) ? 0 : 2
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    // Taka need the narrow ৳, which the plain symbol spells "BDT". The rest use the plain
    // symbol, because the narrow one is a bare "$" or "¥" for several currencies at once.
    currencyDisplay: currency === 'BDT' ? 'narrowSymbol' : 'symbol',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    // Both leave out the sign on zero, including an amount that rounds to zero.
    signDisplay: opts.signed ? 'exceptZero' : 'negative',
  }

  if (currency === 'BDT' && locale === 'bn') {
    return symbolFirst(numberFormat(LOCALES.bn.intl, options).formatToParts(amount))
  }
  const tag = currency === 'BDT' && locale === 'en' ? 'en-IN' : LOCALES[locale].intl
  return toText(numberFormat(tag, options).formatToParts(amount))
}

function formatPercentage(ratio: number, locale: LocaleCode, maximumFractionDigits: number) {
  if (!Number.isFinite(ratio)) return NO_VALUE

  const format = numberFormat(LOCALES[locale].intl, {
    style: 'percent',
    maximumFractionDigits,
    signDisplay: 'negative',
  })
  return toText(format.formatToParts(ratio))
}

/** A ratio such as 0.07 as a whole-number percentage: "7%". */
export function formatPercent(ratio: number, locale: LocaleCode): string {
  return formatPercentage(ratio, locale, 0)
}

/** A plain number with a fixed count of decimals, for example months of savings. */
export function formatNumber(n: number, locale: LocaleCode, decimals = 0): string {
  if (!Number.isFinite(n)) return NO_VALUE

  const format = numberFormat(LOCALES[locale].intl, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: 'negative',
  })
  return toText(format.formatToParts(n))
}

/** Score points are kept in hundredths: 1450 is shown as "14.50". */
export function formatPoints(hundredths: number, locale: LocaleCode): string {
  return formatNumber(hundredths / 100, locale, 2)
}

/** A measure's weight is kept in tenths of a percent: 250 is "25%" and 333 is "33.3%". */
export function formatWeight(tenths: number, locale: LocaleCode): string {
  return formatPercentage(tenths / 1000, locale, 1)
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(tag: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tag} ${JSON.stringify(options)}`
  let format = dateFormats.get(key)
  if (!format) {
    // UTC on both sides, so the calendar day never shifts with the visitor's time zone.
    format = new Intl.DateTimeFormat(tag, { ...options, timeZone: 'UTC' })
    dateFormats.set(key, format)
  }
  return format
}

/** A real calendar day as UTC midnight, or null for something like 31 February. */
function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day))
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return real ? date : null
}

const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' }

/** The first day of a 'YYYY-MM' month, or null for text that is not a month. */
function monthStart(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  return match ? utcDate(Number(match[1]), Number(match[2]), 1) : null
}

/** "Oct 2026", from 'YYYY-MM'. Text that is not a month is returned as it came. */
export function formatMonth(month: string, locale: LocaleCode): string {
  const date = monthStart(month)
  if (!date) return month

  return dateFormat(LOCALES[locale].intl, MONTH_YEAR).format(date)
}

/**
 * "May – Oct 2026", from two 'YYYY-MM' months, oldest first. Each language joins the two
 * its own way and writes a shared year once. One month on its own is just that month.
 */
export function formatMonthRange(first: string, last: string, locale: LocaleCode): string {
  const from = monthStart(first)
  const to = monthStart(last)
  if (!from || !to) return `${formatMonth(first, locale)}–${formatMonth(last, locale)}`
  if (first === last) return formatMonth(first, locale)

  return dateFormat(LOCALES[locale].intl, MONTH_YEAR).formatRange(from, to)
}

/**
 * A calendar day from 'YYYY-MM-DD', with or without its year. Text that is not a real date
 * is returned as it came.
 */
function formatDay(date: string, locale: LocaleCode, { withYear }: { withYear: boolean }): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const day = match ? utcDate(Number(match[1]), Number(match[2]), Number(match[3])) : null
  if (!day) return date

  const options: Intl.DateTimeFormatOptions = withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' }
  const parts = dateFormat(LOCALES[locale].intl, options).formatToParts(day)
  if (locale !== 'en') return parts.map((part) => part.value).join('')

  // Plain English puts the month first ("Oct 31"). Readers here expect "31 Oct", and the
  // day-first English locales spell September "Sept", which would not match "Sep 2026".
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const dayFirst = [value('day'), value('month')]
  return (withYear ? [...dayFirst, value('year')] : dayFirst).join(' ')
}

/** "31 Oct", from 'YYYY-MM-DD'. Text that is not a date is returned as it came. */
export function formatDate(date: string, locale: LocaleCode): string {
  return formatDay(date, locale, { withYear: false })
}

/** "3 Nov 2026", from 'YYYY-MM-DD'. Text that is not a date is returned as it came. */
export function formatFullDate(date: string, locale: LocaleCode): string {
  return formatDay(date, locale, { withYear: true })
}
