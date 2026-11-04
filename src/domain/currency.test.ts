import { describe, expect, it } from 'vitest'
import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from './types'
import { RATES, convert, parseRatesSnapshot, toBDT, type RatesSnapshot } from './currency'

const fx: RatesSnapshot = {
  base: 'BDT',
  date: '2026-11-03',
  source: 'Test fixture',
  sourceUrl: 'https://example.test',
  perBDT: {
    BDT: 1,
    USD: 0.008,
    EUR: 0.007,
    JPY: 1.2,
    GBP: 0.006,
    CNY: 0.057,
    CHF: 0.0065,
    AUD: 0.0125,
    CAD: 0.011,
    HKD: 0.062,
    SGD: 0.0105,
  },
}

describe('convert', () => {
  it('converts into and out of BDT', () => {
    expect(convert(100, 'USD', 'BDT', fx)).toBe(12500)
    expect(convert(12500, 'BDT', 'USD', fx)).toBe(100)
  })

  it('returns the amount unchanged for the same currency', () => {
    expect(convert(5, 'GBP', 'GBP', fx)).toBe(5)
  })

  it('returns the amount exactly for the same currency, with no rounding drift', () => {
    // (0.38 / 1.2) * 1.2 is 0.38000000000000006 in floating point.
    expect(convert(0.38, 'JPY', 'JPY', fx)).toBe(0.38)
    expect(toBDT(0.38, 'BDT', fx)).toBe(0.38)
  })

  it('still rejects an unknown currency when both sides are the same', () => {
    expect(() => convert(1, 'XXX' as never, 'XXX' as never, fx)).toThrow(/unknown currency.*XXX/i)
  })

  it('goes through BDT when converting between two foreign currencies', () => {
    expect(convert(100, 'USD', 'EUR', fx)).toBeCloseTo((100 / 0.008) * 0.007, 10)
  })

  it('keeps the sign of outgoing amounts', () => {
    expect(convert(-100, 'USD', 'BDT', fx)).toBe(-12500)
  })

  it('throws a clear error for an unknown currency code', () => {
    expect(() => convert(1, 'XXX' as never, 'BDT', fx)).toThrow(/unknown currency.*XXX/i)
    expect(() => convert(1, 'BDT', 'toString' as never, fx)).toThrow(/unknown currency.*toString/i)
  })

  it('uses the bundled rates when none are passed', () => {
    expect(convert(1000, 'BDT', 'USD')).toBeCloseTo(1000 * RATES.perBDT.USD, 10)
  })
})

describe('toBDT', () => {
  it('converts to taka', () => {
    expect(toBDT(100, 'USD', fx)).toBe(12500)
    expect(toBDT(250, 'BDT', fx)).toBe(250)
  })
})

describe('RATES', () => {
  it('has a positive rate for every supported currency, with BDT at 1', () => {
    for (const code of CURRENCY_CODES) {
      expect(RATES.perBDT[code], code).toBeGreaterThan(0)
    }
    expect(RATES.perBDT.BDT).toBe(1)
  })

  it('records the snapshot date, base and source', () => {
    expect(RATES.base).toBe('BDT')
    expect(RATES.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(RATES.source).not.toBe('')
    expect(RATES.sourceUrl).toMatch(/^https:\/\//)
  })
})

describe('parseRatesSnapshot', () => {
  it('accepts a well-formed snapshot', () => {
    expect(parseRatesSnapshot(fx)).toEqual(fx)
  })

  it('rejects a snapshot with a missing currency', () => {
    const perBDT: Partial<Record<CurrencyCode, number>> = { ...fx.perBDT }
    delete perBDT.GBP
    expect(() => parseRatesSnapshot({ ...fx, perBDT })).toThrow(/GBP/)
  })

  it('rejects a non-positive rate', () => {
    expect(() => parseRatesSnapshot({ ...fx, perBDT: { ...fx.perBDT, USD: 0 } })).toThrow(/USD/)
    expect(() => parseRatesSnapshot({ ...fx, perBDT: { ...fx.perBDT, USD: -1 } })).toThrow(/USD/)
    expect(() => parseRatesSnapshot({ ...fx, perBDT: { ...fx.perBDT, USD: Number.NaN } })).toThrow(/USD/)
  })

  it('rejects a snapshot whose BDT rate is not 1', () => {
    expect(() => parseRatesSnapshot({ ...fx, perBDT: { ...fx.perBDT, BDT: 2 } })).toThrow(/BDT/)
  })

  it('rejects a malformed date', () => {
    expect(() => parseRatesSnapshot({ ...fx, date: '3 Nov 2026' })).toThrow(/date/i)
  })

  it('rejects a snapshot that is not an object', () => {
    expect(() => parseRatesSnapshot(null)).toThrow(/rates/i)
  })
})

describe('isCurrencyCode', () => {
  it('accepts the eleven codes and nothing else', () => {
    for (const code of CURRENCY_CODES) expect(isCurrencyCode(code)).toBe(true)

    expect(isCurrencyCode('XYZ')).toBe(false)
    expect(isCurrencyCode('bdt')).toBe(false)
    expect(isCurrencyCode('')).toBe(false)
    expect(isCurrencyCode('toString')).toBe(false)
  })
})
