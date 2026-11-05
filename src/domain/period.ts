/** The first and last months are only partly covered. This many days at the edge decide if they count. */
export const EDGE_DAYS = 7

/** The score never looks back further than this many complete months. */
export const MAX_MONTHS = 12

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

interface DateParts {
  year: number
  /** 1 to 12 */
  month: number
  day: number
}

/**
 * Number of days in a calendar month. `month` is 1 to 12. Leap years follow the 4, 100 and 400
 * rule for any year. `Date.UTC` is not used because it reads years 0 to 99 as 1900 to 1999.
 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return leap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function parseDate(date: string): DateParts {
  const match = DATE_PATTERN.exec(date)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return { year, month, day }
    }
  }
  throw new Error(`Invalid date ${JSON.stringify(date)}: expected YYYY-MM-DD`)
}

function formatMonth(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`
}

/** The calendar month of a `YYYY-MM-DD` date, as `YYYY-MM`. */
export function monthOf(date: string): string {
  const { year, month } = parseDate(date)
  return formatMonth(year, month)
}

/**
 * The months whose data is complete enough to score, oldest first.
 *
 * Every month between the first and last transaction counts, except that the
 * first month is dropped when the earliest transaction falls after the 7th,
 * and the last month is dropped when the latest transaction falls before the
 * final 7 days of that month. Only the latest `maxMonths` are kept.
 *
 * Dates must be valid `YYYY-MM-DD` strings, in any order.
 */
export function completeMonths(dates: readonly string[], maxMonths = MAX_MONTHS): string[] {
  const [firstDate] = dates
  if (firstDate === undefined) return []

  // For zero-padded YYYY-MM-DD strings, text order is the same as date order.
  let earliest = firstDate
  let latest = firstDate
  for (const date of dates) {
    if (date < earliest) earliest = date
    if (date > latest) latest = date
  }

  const first = parseDate(earliest)
  const last = parseDate(latest)

  // Count months as a single number so stepping across a year end is plain addition.
  let startIndex = first.year * 12 + (first.month - 1)
  let endIndex = last.year * 12 + (last.month - 1)

  if (first.day > EDGE_DAYS) startIndex += 1
  if (last.day <= daysInMonth(last.year, last.month) - EDGE_DAYS) endIndex -= 1

  const months: string[] = []
  for (let index = startIndex; index <= endIndex; index++) {
    months.push(formatMonth(Math.floor(index / 12), (index % 12) + 1))
  }

  return months.slice(Math.max(0, months.length - maxMonths))
}
