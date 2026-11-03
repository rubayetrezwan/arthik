// Readers for single date and amount cells of a CSV file (spec 8). Each one takes the text of
// one cell and returns what it means, or null when it cannot be read exactly: a cell that
// is read wrongly would be a wrong number on screen, so nothing here guesses. Pure: no
// React, no DOM and no File API.

import { daysInMonth } from './period'

/** Bengali digits ০ to ৯ as 0 to 9, so a Bengali-locale spreadsheet reads like any other. */
function toAsciiDigits(text: string): string {
  return text.replace(/[\u{9E6}-\u{9EF}]/gu, (digit) => String(digit.charCodeAt(0) - 0x09e6))
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

// Dates outside these years are typos (0026 for 2026) or a spreadsheet's stand-in for "no
// date" (0000, 9999), not transactions, though the calendar would allow them.
const FIRST_YEAR = 1990
const LAST_YEAR = 2100

/** A real calendar date as `YYYY-MM-DD` in the years the reader accepts, or null. */
function buildDate(year: number, month: number, day: number): string | null {
  if (year < FIRST_YEAR || year > LAST_YEAR) return null
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null
  const pad = (value: number, length: number) => String(value).padStart(length, '0')
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** What a date cell turned out to be. */
export interface DateReading {
  /**
   * The date as `YYYY-MM-DD`, or null if the cell is not a real date read day first (or in
   * the `YYYY-MM-DD` form).
   */
  date: string | null
  /**
   * The cell is a real date read day first and a different real date read month first, as
   * 10/05/2026 is 10 May or 5 October. Equal parts (05/05/2026) read the same either way and
   * are never ambiguous, and neither is anything with a part above 12.
   */
  ambiguous: boolean
  /** The cell can only be a month-first date: it is not one day first, but it is one month first (10/31/2026). */
  monthFirstOnly: boolean
}

const NOT_A_DATE: DateReading = { date: null, ambiguous: false, monthFirstOnly: false }

/**
 * Reads a date cell: `YYYY-MM-DD`, or day first as `DD/MM/YYYY`, `DD-MM-YYYY` or
 * `DD.MM.YYYY`, optionally followed by a time of day (`31/10/2026 14:03`,
 * `2026-10-31T14:03:22+06:00`), which is ignored. A date followed by anything that is not a
 * time is not a date. `date` is always a real calendar date in `YYYY-MM-DD` form, which is what
 * the rest of the domain code expects.
 *
 * A month-first date such as 10/31/2026 is not a `date`, but it is reported as
 * `monthFirstOnly`, so the caller can tell the visitor what is wrong instead of just that the
 * cell is not a date, and can stop trusting dates like 10/05/2026 in the same file.
 */
export function readDateCell(text: string): DateReading {
  const digits = toAsciiDigits(text)

  const iso = ISO_DATE.exec(digits)
  if (iso) {
    const [, year = '', month = '', day = ''] = iso
    const date = buildDate(Number(year), Number(month), Number(day))
    return { date, ambiguous: false, monthFirstOnly: false }
  }

  const dayFirst = DAY_FIRST_DATE.exec(digits)
  if (dayFirst) {
    const [, firstText = '', , secondText = '', year = ''] = dayFirst
    const first = Number(firstText)
    const second = Number(secondText)
    const date = buildDate(Number(year), second, first)
    const monthFirst = buildDate(Number(year), first, second)
    return {
      date,
      ambiguous: date !== null && monthFirst !== null && first !== second,
      monthFirstOnly: date === null && monthFirst !== null,
    }
  }
  return NOT_A_DATE
}

// The whole part is plain digits, Western groups (1,234,567) or lakh groups (12,34,567),
// which is how Bangladeshi banks print it. Anything else with a comma, such as 12,50, is
// more likely a decimal comma than a thousands separator. Reading it as 1250 would be
// silently wrong, so it is not a number here.
//
// A space can separate the groups in place of a comma (1 234 567, 12 34 567), and then it
// has to follow the same grouping, so 12 50 is no more a number than 12,50 is. One kind of
// separator at a time: 1,234 567 is not a number.
function groups(separator: string): string {
  return String.raw`\d{1,3}(?:${separator}\d{3})+|\d{1,2}(?:${separator}\d{2})+${separator}\d{3}`
}
const NUMBER = new RegExp(String.raw`^(\d+|${groups(',')}|${groups(' ')})(\.\d+)?$`)

// 1.500 reads as 1500 where a point groups thousands and as 1.5 where it is the decimal mark,
// and the cell does not say which. Only a short whole number can be followed by a group, so
// 1234.567 is plainly a decimal, and a comma group before the point (1,234.567) says the point
// is the decimal mark.
const POINT_AND_THREE_DIGITS = /^\d{1,3}\.\d{3}$/

/**
 * Reads an amount such as `1,234.50`, `1 234.50`, `(640)`, `৳ 1,240`, `১,২৪০` or `-$5`.
 * Brackets mean negative. Spaces around the number, and between it and a currency sign, a sign
 * or a bracket, are ignored; a space inside the number must separate thousands the way a comma
 * would. Returns null for anything else, including an empty cell, and for a cell that could
 * be read two ways with different values, such as 12,50, 12 50 or 1.500, and for one too large
 * to be kept to the cent (over about 90 trillion).
 */
export function parseAmount(text: string): number | null {
  const cleaned = toAsciiDigits(text)
    .replace(/[৳$£€]/g, '')
    // The minus sign that word processors and some banks write.
    .replace(/\u{2212}/gu, '-')
    // A sign or a bracket does not care about the space beside it. What space is left then
    // lies inside the number, and any kind of it (no-break, narrow) counts as one plain space.
    .replace(/\s*([()+-])\s*/g, '$1')
    .trim()
    .replace(/\s/g, ' ')
  const bracketed = /^\((.*)\)$/.exec(cleaned)
  const unwrapped = bracketed ? (bracketed[1] ?? '') : cleaned

  const sign = /^[+-]/.exec(unwrapped)?.[0] ?? ''
  // (-640) says negative twice.
  if (bracketed && sign) return null

  const unsigned = unwrapped.slice(sign.length)
  if (POINT_AND_THREE_DIGITS.test(unsigned)) return null
  const parts = NUMBER.exec(unsigned)
  if (!parts) return null
  const [, whole = '', fraction = ''] = parts
  const value = Number(whole.replaceAll(/[, ]/g, '') + fraction)
  // Money is added up in cents, which is only exact up to Number.MAX_SAFE_INTEGER. A larger
  // amount would have digits that were rounded away, so it is not read.
  if (!Number.isFinite(value) || Math.round(value * 100) > Number.MAX_SAFE_INTEGER) return null
  return sign === '-' || bracketed ? -value : value
}
