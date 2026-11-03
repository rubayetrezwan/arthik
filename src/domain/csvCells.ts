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
export function parseDate(text: string): string | null {
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
export function parseAmount(text: string): number | null {
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
