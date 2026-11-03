// Turns a person's config into six months of transactions, 1 May to 31 October 2026.
// A config lists recurring items (a fixed day each month, a little jitter) and
// scattered items (a few lines a month, on random days). Every item draws from its own
// seeded random stream, so editing an item never moves another item's lines. Adding or
// removing an item moves the streams of the items after it.
//
// No Node imports here: the sample tests import this code too.

import { categorize } from '../../src/domain/categorize'
import { daysInMonth } from '../../src/domain/period'
import type {
  CategoryId,
  CurrencyCode,
  Dataset,
  PersonId,
  Transaction,
} from '../../src/domain/types'
import { mulberry32 } from './rng'

const YEAR = 2026
/** May to October. */
const MONTHS = [5, 6, 7, 8, 9, 10] as const
const FIRST_DATE = '2026-05-01'
const LAST_DATE = '2026-10-31'

/** A fixed amount, or a range `[low, high]` to draw from. Money out is negative. */
export type Amount = number | readonly [low: number, high: number]

interface ItemBase {
  /**
   * The statement line. A list means each line takes one of them at random. Three
   * placeholders stand for the codes a real receipt carries, each drawn fresh per line:
   * `{ref}` six digits, `{hex}` eight hex digits, `{code}` nine letters and digits.
   */
  description: string | readonly string[]
  /** The category this line must get. The generator stops if the categoriser disagrees. */
  category: CategoryId
  amount: Amount
  /** Defaults to the person's own currency. */
  currency?: CurrencyCode
  /** Round amounts to a multiple of this. Defaults to 1 for taka and 0.01 for other currencies. */
  roundTo?: number
  /** Only these calendar months (5 is May). Defaults to all six. */
  inMonths?: readonly number[]
  /** A second line on the same day, as a share of the first (a wallet's cash-out charge). */
  charge?: { description: string; rate: number }
  /**
   * A provider's fee that is added to the amount paid, as a share of it, so the statement
   * shows one debit and not a payment plus a fee (a remittance service does this).
   */
  feeIncluded?: number
}

/** One line a month, near a fixed day. */
export interface MonthlyItem extends ItemBase {
  /** Day of the month, or 'last'. A day past the month's end moves to the last day. */
  day: number | 'last'
  /** The date may move this many days either way. */
  jitterDays?: number
}

/** A few lines a month, each on a random day. */
export interface ScatteredItem extends ItemBase {
  /** How many lines a month, `[fewest, most]`. */
  perMonth: readonly [fewest: number, most: number]
  /**
   * No lines from the first date to the last, both included (`YYYY-MM-DD`): a week away
   * from the city has no ride-hailing or pharmacy in it.
   */
  skipBetween?: readonly [from: string, to: string]
}

export interface Persona {
  id: PersonId
  seed: number
  currency: CurrencyCode
  /** Savings set aside for emergencies, in the person's own currency. */
  emergencySavings: number
  monthly: readonly MonthlyItem[]
  scattered: readonly ScatteredItem[]
}

interface Line {
  date: string
  description: string
  amount: number
  currency: CurrencyCode
  category: CategoryId
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function round(value: number, step: number): number {
  // toFixed clears the floating-point tail that a multiple of 0.01 can pick up.
  return Number((Math.round(value / step) * step).toFixed(2))
}

const HEX_DIGITS = '0123456789ABCDEF'
const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789'

/** One item's random stream. */
function randomStream(seed: number) {
  const next = mulberry32(seed)
  return {
    /** A whole number from `low` to `high`, both included. */
    int: (low: number, high: number) => low + Math.floor(next() * (high - low + 1)),
    pick: <T>(options: readonly T[]): T => options[Math.floor(next() * options.length)] as T,
    between: (low: number, high: number) => low + next() * (high - low),
    /** `length` characters drawn from `characters`. */
    code: (length: number, characters: string) =>
      Array.from({ length }, () => characters[Math.floor(next() * characters.length)]).join(''),
  }
}

type Random = ReturnType<typeof randomStream>

function monthsOf(item: ItemBase): number[] {
  return MONTHS.filter((month) => !item.inMonths || item.inMonths.includes(month))
}

/** The lines for one item on the given days of one month. */
function linesOn(
  item: ItemBase,
  currency: CurrencyCode,
  month: number,
  days: readonly number[],
  random: Random,
): Line[] {
  const step = item.roundTo ?? (currency === 'BDT' ? 1 : 0.01)
  const [low, high] = typeof item.amount === 'number' ? [item.amount, item.amount] : item.amount
  const wordings = typeof item.description === 'string' ? [item.description] : item.description

  return days.flatMap((day) => {
    const date = `${YEAR}-${pad2(month)}-${pad2(day)}`
    const chosen = round(random.between(low, high), step)
    const amount = item.feeIncluded ? round(chosen * (1 + item.feeIncluded), 0.01) : chosen
    const description = random
      .pick(wordings)
      .replace('{ref}', () => String(random.int(100_000, 999_999)))
      .replace('{hex}', () => random.code(8, HEX_DIGITS))
      .replace('{code}', () => random.code(9, CODE_CHARACTERS))

    const lines: Line[] = [{ date, description, amount, currency, category: item.category }]
    if (item.charge) {
      lines.push({
        date,
        description: item.charge.description,
        amount: -round(Math.abs(amount) * item.charge.rate, 0.01),
        currency,
        category: 'fees',
      })
    }
    return lines
  })
}

function monthlyLines(item: MonthlyItem, currency: CurrencyCode, random: Random): Line[] {
  return monthsOf(item).flatMap((month) => {
    const last = daysInMonth(YEAR, month)
    const planned = item.day === 'last' ? last : Math.min(item.day, last)
    const jitter = item.jitterDays ? random.int(-item.jitterDays, item.jitterDays) : 0
    const day = Math.min(Math.max(planned + jitter, 1), last)
    return linesOn(item, currency, month, [day], random)
  })
}

/** The days of a month an item may fall on: all of them, less the item's skipped dates. */
function openDays(item: ScatteredItem, month: number): number[] {
  const days = Array.from({ length: daysInMonth(YEAR, month) }, (_, index) => index + 1)
  const skip = item.skipBetween
  if (!skip) return days
  const open = days.filter((day) => {
    const date = `${YEAR}-${pad2(month)}-${pad2(day)}`
    return date < skip[0] || date > skip[1]
  })
  if (open.length === 0) throw new Error(`${String(item.description)}: no open day in month ${month}`)
  return open
}

function scatteredLines(item: ScatteredItem, currency: CurrencyCode, random: Random): Line[] {
  return monthsOf(item).flatMap((month) => {
    const open = openDays(item, month)
    const count = random.int(item.perMonth[0], item.perMonth[1])
    const days = Array.from({ length: count }, () => open[random.int(0, open.length - 1)] as number)
    return linesOn(item, currency, month, days, random)
  })
}

/** Throws if the categoriser would read a line differently from what the config intends. */
function checkedTransaction(persona: Persona, line: Line, index: number): Transaction {
  const read = categorize(line.description, line.amount)
  if (read.category !== line.category) {
    throw new Error(
      `${persona.id}: "${line.description}" (${line.amount}) is meant to be ${line.category} ` +
        `but the categoriser reads it as ${read.category}`,
    )
  }
  return {
    id: `${persona.id}-${String(index + 1).padStart(4, '0')}`,
    date: line.date,
    description: line.description,
    amount: line.amount,
    currency: line.currency,
    category: line.category,
    ...(read.unrecognisedIncome ? { unrecognisedIncome: true } : {}),
  }
}

export function buildDataset(persona: Persona): Dataset {
  const items = [...persona.monthly, ...persona.scattered]
  const lines = items.flatMap((item, index) => {
    const random = randomStream(persona.seed * 1000 + index)
    const currency = item.currency ?? persona.currency
    return 'day' in item
      ? monthlyLines(item, currency, random)
      : scatteredLines(item, currency, random)
  })

  // Array.prototype.sort is stable, so lines on one day keep the order they were made in.
  // That keeps a charge right after the cash-out it belongs to.
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const first = lines[0]?.date
  const last = lines.at(-1)?.date
  if (first !== FIRST_DATE || last !== LAST_DATE) {
    throw new Error(`${persona.id}: lines run from ${first} to ${last}, not 1 May to 31 October`)
  }

  return {
    key: persona.id,
    emergencySavings: { amount: persona.emergencySavings, currency: persona.currency },
    transactions: lines.map((line, index) => checkedTransaction(persona, line, index)),
  }
}
