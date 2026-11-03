import { afterEach, describe, expect, it, vi } from 'vitest'
import { CURRENCY_CODES } from '../domain/types'
import {
  formatDate,
  formatMoney,
  formatMonth,
  formatNumber,
  formatPercent,
  formatPoints,
  formatWeight,
} from './format'
import { LOCALE_CODES } from './locales'

/** Strips the invisible direction marks and turns every no-break space into a plain one. */
function plain(text: string): string {
  return text.replace(/[\u200e\u200f]/g, '').replace(/[\u00a0\u202f]/g, ' ')
}

const MINUS = '\u2212'

describe('formatMoney', () => {
  it('groups English taka in lakhs with the symbol in front', () => {
    expect(formatMoney(150000, 'BDT', 'en')).toBe('৳1,50,000')
    expect(formatMoney(1610.4, 'BDT', 'en')).toBe('৳1,610')
    expect(formatMoney(12345678, 'BDT', 'en')).toBe('৳1,23,45,678')
  })

  it('shows Bengali digits and keeps the symbol in front for taka in Bengali', () => {
    expect(formatMoney(150000, 'BDT', 'bn')).toBe('৳১,৫০,০০০')
  })

  it('shows taka in Hindi with Western digits and lakh grouping', () => {
    expect(formatMoney(150000, 'BDT', 'hi')).toBe('৳1,50,000')
  })

  it('keeps the plain symbol for the dollar, yen, pound and euro in English', () => {
    expect(formatMoney(13.2, 'USD', 'en')).toBe('$13.20')
    expect(formatMoney(1500, 'JPY', 'en')).toBe('¥1,500')
    expect(formatMoney(1234.5, 'GBP', 'en')).toBe('£1,234.50')
    expect(formatMoney(1234.5, 'EUR', 'en')).toBe('€1,234.50')
  })

  it('tells apart the currencies that share a narrow symbol, in English', () => {
    expect(formatMoney(13.2, 'AUD', 'en')).toBe('A$13.20')
    expect(formatMoney(13.2, 'CAD', 'en')).toBe('CA$13.20')
    expect(formatMoney(13.2, 'HKD', 'en')).toBe('HK$13.20')
    expect(formatMoney(13.2, 'CNY', 'en')).toBe('CN¥13.20')
    expect(plain(formatMoney(13.2, 'SGD', 'en'))).toBe('SGD 13.20')
  })

  it('shows one unit of each of the 11 currencies differently in English and Bengali', () => {
    for (const l of ['en', 'bn'] as const) {
      const shown = CURRENCY_CODES.map((code) => formatMoney(1, code, l))

      expect(new Set(shown).size, `${l}: ${shown.join(' | ')}`).toBe(CURRENCY_CODES.length)
    }
  })

  it('keeps the taka symbol in front in every language, whatever the other currencies do', () => {
    for (const l of LOCALE_CODES) {
      const text = plain(formatMoney(1, 'BDT', l))

      expect(text, l).toContain('৳')
      expect(text, l).not.toContain('BDT')
    }
  })

  it('shows no decimals for taka and yen and two for everything else', () => {
    for (const code of CURRENCY_CODES) {
      const text = formatMoney(1234.5, code, 'en')

      if (code === 'BDT' || code === 'JPY') {
        expect(text, code).not.toMatch(/[.,]\d{1,2}$/)
      } else {
        expect(text, code).toMatch(/\.50$/)
      }
    }
  })

  it('writes a negative amount with a true minus sign in front of the symbol', () => {
    expect(formatMoney(-640, 'BDT', 'en')).toBe(`${MINUS}৳640`)
    expect(formatMoney(-640, 'BDT', 'bn')).toBe(`${MINUS}৳৬৪০`)
    expect(formatMoney(-13.2, 'USD', 'en')).toBe(`${MINUS}$13.20`)
  })

  it('uses U+2212 and never a hyphen in every language', () => {
    for (const l of LOCALE_CODES) {
      const text = formatMoney(-640, 'BDT', l)

      expect(text, l).toContain(MINUS)
      expect(text, l).not.toContain('-')
    }
  })

  it('adds a plus sign to positive amounts only when asked', () => {
    expect(formatMoney(4000, 'BDT', 'en', { signed: true })).toBe('+৳4,000')
    expect(formatMoney(4000, 'BDT', 'en')).toBe('৳4,000')
    expect(formatMoney(4000, 'BDT', 'bn', { signed: true })).toBe('+৳৪,০০০')
    expect(formatMoney(-640, 'BDT', 'en', { signed: true })).toBe(`${MINUS}৳640`)
  })

  it('shows zero without any sign', () => {
    expect(formatMoney(0, 'BDT', 'en', { signed: true })).toBe('৳0')
    expect(formatMoney(0, 'BDT', 'en')).toBe('৳0')
    expect(formatMoney(-0, 'BDT', 'en')).toBe('৳0')
  })

  it('does not print a sign for an amount that rounds to zero', () => {
    expect(formatMoney(-0.4, 'BDT', 'en')).toBe('৳0')
    expect(formatMoney(-0.004, 'USD', 'en')).toBe('$0.00')
    expect(formatMoney(0.4, 'BDT', 'en', { signed: true })).toBe('৳0')
  })

  it('follows each language for the other languages', () => {
    expect(plain(formatMoney(150000, 'BDT', 'es'))).toBe('150.000 ৳')
    expect(plain(formatMoney(150000, 'BDT', 'fr'))).toBe('150 000 ৳')
  })

  it('keeps the taka symbol and the digits in Spanish, French, Arabic and Chinese', () => {
    for (const l of ['es', 'fr', 'ar', 'zh'] as const) {
      const text = plain(formatMoney(150000, 'BDT', l))

      expect(text, l).toContain('৳')
      expect(text, l).toContain('150')
      expect(text, l).toContain('000')
    }
  })

  it('returns a clean string for every currency in every language', () => {
    for (const l of LOCALE_CODES) {
      for (const code of CURRENCY_CODES) {
        const text = formatMoney(1234.5, code, l)

        expect(text, `${code} ${l}`).not.toBe('')
        expect(text, `${code} ${l}`).not.toMatch(/NaN|undefined/)
      }
    }
  })
})

describe('formatPercent', () => {
  it('shows whole numbers', () => {
    expect(formatPercent(0.07, 'en')).toBe('7%')
    expect(formatPercent(0.5, 'en')).toBe('50%')
    expect(formatPercent(0.0749, 'en')).toBe('7%')
    expect(formatPercent(1, 'en')).toBe('100%')
  })

  it('uses Bengali digits in Bengali', () => {
    expect(formatPercent(0.07, 'bn')).toBe('৭%')
  })

  it('writes a negative percentage with U+2212', () => {
    expect(formatPercent(-0.096, 'en')).toBe(`${MINUS}10%`)
    expect(formatPercent(-0.001, 'en')).toBe('0%')
  })

  it('keeps the digit and the percent sign in Arabic', () => {
    const text = plain(formatPercent(0.07, 'ar'))

    expect(text).toContain('7')
    expect(text).toContain('%')
  })
})

describe('formatNumber', () => {
  it('rounds to whole numbers by default', () => {
    expect(formatNumber(1234.567, 'en')).toBe('1,235')
    expect(formatNumber(0, 'en')).toBe('0')
  })

  it('always shows the number of decimals asked for', () => {
    expect(formatNumber(2, 'en', 1)).toBe('2.0')
    expect(formatNumber(1234.5, 'en', 1)).toBe('1,234.5')
    expect(formatNumber(1.234, 'en', 2)).toBe('1.23')
  })

  it('uses Bengali digits in Bengali', () => {
    expect(formatNumber(1.5, 'bn', 1)).toBe('১.৫')
  })

  it('writes a negative number with U+2212', () => {
    expect(formatNumber(-2.5, 'en', 1)).toBe(`${MINUS}2.5`)
  })
})

describe('formatPoints', () => {
  it('turns hundredths into points with two decimals', () => {
    expect(formatPoints(1450, 'en')).toBe('14.50')
    expect(formatPoints(1450, 'bn')).toBe('১৪.৫০')
    expect(formatPoints(8775, 'en')).toBe('87.75')
    expect(formatPoints(0, 'en')).toBe('0.00')
    expect(formatPoints(10000, 'en')).toBe('100.00')
  })
})

describe('formatWeight', () => {
  it('turns tenths of a percent into a percentage with at most one decimal', () => {
    expect(formatWeight(250, 'en')).toBe('25%')
    expect(formatWeight(333, 'en')).toBe('33.3%')
    expect(formatWeight(125, 'en')).toBe('12.5%')
    expect(formatWeight(0, 'en')).toBe('0%')
  })

  it('uses Bengali digits in Bengali', () => {
    expect(formatWeight(250, 'bn')).toBe('২৫%')
  })
})

describe('formatMonth', () => {
  it('shows the short month and the year', () => {
    expect(formatMonth('2026-10', 'en')).toBe('Oct 2026')
    expect(formatMonth('2026-01', 'en')).toBe('Jan 2026')
    expect(formatMonth('2026-12', 'en')).toBe('Dec 2026')
  })

  it('uses Bengali digits in Bengali', () => {
    expect(formatMonth('2026-10', 'bn')).toContain('২০২৬')
  })

  it('returns the text unchanged when it is not a month', () => {
    expect(formatMonth('2026-13', 'en')).toBe('2026-13')
    expect(formatMonth('2026-00', 'en')).toBe('2026-00')
    expect(formatMonth('October', 'en')).toBe('October')
    expect(formatMonth('', 'en')).toBe('')
  })
})

describe('formatDate', () => {
  it('shows the day before the month in English', () => {
    expect(formatDate('2026-10-31', 'en')).toBe('31 Oct')
    expect(formatDate('2026-05-01', 'en')).toBe('1 May')
  })

  it('follows each language', () => {
    expect(formatDate('2026-10-31', 'bn')).toContain('৩১')
    expect(formatDate('2026-10-31', 'zh')).toBe('10月31日')
    expect(plain(formatDate('2026-10-31', 'es'))).toMatch(/^31 oct/)
    expect(plain(formatDate('2026-10-31', 'fr'))).toMatch(/^31 oct/)
    expect(formatDate('2026-10-31', 'ar')).toContain('31')
    expect(formatDate('2026-10-31', 'hi')).toContain('31')
  })

  it('returns the text unchanged when it is not a real date', () => {
    expect(formatDate('2026-02-31', 'en')).toBe('2026-02-31')
    expect(formatDate('2026-10', 'en')).toBe('2026-10')
    expect(formatDate('31/10/2026', 'en')).toBe('31/10/2026')
    expect(formatDate('', 'en')).toBe('')
  })

  describe('in any time zone', () => {
    const original = process.env.TZ

    afterEach(() => {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
      vi.resetModules()
    })

    // A fresh copy of the module each time, so no formatter built in another zone is reused.
    it.each(['Pacific/Auckland', 'America/Los_Angeles', 'Asia/Dhaka'])(
      'keeps the same calendar day in %s',
      async (zone) => {
        process.env.TZ = zone
        vi.resetModules()
        const { formatDate, formatMonth } = await import('./format')

        expect(formatDate('2026-10-31', 'en')).toBe('31 Oct')
        expect(formatDate('2026-01-01', 'en')).toBe('1 Jan')
        expect(formatMonth('2026-01', 'en')).toBe('Jan 2026')
        expect(formatMonth('2026-12', 'en')).toBe('Dec 2026')
      },
    )
  })
})
