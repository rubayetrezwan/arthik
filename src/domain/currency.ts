import ratesJson from '../data/rates.json'
import { CURRENCY_CODES, type CurrencyCode } from './types'

export interface RatesSnapshot {
  base: 'BDT'
  /** YYYY-MM-DD, UTC */
  date: string
  source: string
  sourceUrl: string
  /** How many units of each currency one taka buys. */
  perBDT: Record<CurrencyCode, number>
}

/** Checks the shape of a snapshot so a bad rates file fails loudly at load. */
export function parseRatesSnapshot(raw: unknown): RatesSnapshot {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid rates snapshot: expected an object')
  }
  const { base, date, source, sourceUrl, perBDT } = raw as Record<string, unknown>

  if (base !== 'BDT') {
    throw new Error(`Invalid rates snapshot: base must be "BDT", got ${JSON.stringify(base)}`)
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid rates snapshot: date must be YYYY-MM-DD, got ${JSON.stringify(date)}`)
  }
  if (typeof source !== 'string' || typeof sourceUrl !== 'string' || !source || !sourceUrl) {
    throw new Error('Invalid rates snapshot: source and sourceUrl are required')
  }
  if (typeof perBDT !== 'object' || perBDT === null) {
    throw new Error('Invalid rates snapshot: perBDT is missing')
  }

  const rates = perBDT as Record<string, unknown>
  for (const code of CURRENCY_CODES) {
    const rate = rates[code]
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(
        `Invalid rates snapshot: rate for ${code} must be a positive number, got ${String(rate)}`,
      )
    }
  }
  if (rates.BDT !== 1) {
    throw new Error(`Invalid rates snapshot: BDT must be 1, got ${String(rates.BDT)}`)
  }

  return raw as RatesSnapshot
}

export const RATES: RatesSnapshot = parseRatesSnapshot(ratesJson)

function rateFor(code: CurrencyCode, rates: RatesSnapshot): number {
  if (!Object.hasOwn(rates.perBDT, code)) {
    throw new Error(`Unknown currency code "${String(code)}"`)
  }
  return rates.perBDT[code]
}

export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RatesSnapshot = RATES,
): number {
  const fromRate = rateFor(from, rates)
  const toRate = rateFor(to, rates)
  return (amount / fromRate) * toRate
}

export function toBDT(amount: number, from: CurrencyCode, rates: RatesSnapshot = RATES): number {
  return convert(amount, from, 'BDT', rates)
}
