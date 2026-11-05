import { describe, expect, it } from 'vitest'
import { completeMonths, MAX_MONTHS, monthOf } from './period'

describe('monthOf', () => {
  it('returns the YYYY-MM part of a date', () => {
    expect(monthOf('2026-10-31')).toBe('2026-10')
    expect(monthOf('2026-01-01')).toBe('2026-01')
  })

  it('throws a clear error when the string is not YYYY-MM-DD', () => {
    const notDates = ['', 'not a date', '2026/10/31', '2026-1-5', '31-10-2026', '2026-10-31T00:00:00Z']
    for (const bad of notDates) {
      expect(() => monthOf(bad)).toThrow(`Invalid date ${JSON.stringify(bad)}: expected YYYY-MM-DD`)
    }
  })

  it('throws for a date that does not exist on the calendar', () => {
    expect(() => monthOf('2026-13-01')).toThrow('Invalid date')
    expect(() => monthOf('2026-00-10')).toThrow('Invalid date')
    expect(() => monthOf('2026-02-30')).toThrow('Invalid date')
    expect(() => monthOf('2027-02-29')).toThrow('Invalid date')
  })

  it('accepts 29 February in a leap year', () => {
    expect(monthOf('2028-02-29')).toBe('2028-02')
  })
})

describe('completeMonths', () => {
  it('counts every month from the first to the last when both ends are complete', () => {
    expect(completeMonths(['2026-05-01', '2026-10-31'])).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('returns an empty list when there are no dates', () => {
    expect(completeMonths([])).toEqual([])
  })

  describe('first month', () => {
    it('is dropped when the earliest transaction is after the 7th', () => {
      expect(completeMonths(['2026-05-08', '2026-10-31'])[0]).toBe('2026-06')
    })

    it('counts when the earliest transaction is on the 7th', () => {
      expect(completeMonths(['2026-05-07', '2026-10-31'])[0]).toBe('2026-05')
    })
  })

  describe('last month', () => {
    it('is dropped when the latest transaction is before the final 7 days', () => {
      expect(completeMonths(['2026-05-01', '2026-10-24']).at(-1)).toBe('2026-09')
    })

    it('counts when the latest transaction is on the first of the final 7 days', () => {
      // October has 31 days, so its final 7 days are the 25th to the 31st.
      expect(completeMonths(['2026-05-01', '2026-10-25']).at(-1)).toBe('2026-10')
    })

    it('uses the real length of a short month', () => {
      // February 2026 has 28 days, so its final 7 days are the 22nd to the 28th.
      expect(completeMonths(['2026-01-01', '2026-02-22'])).toEqual(['2026-01', '2026-02'])
      expect(completeMonths(['2026-01-01', '2026-02-21'])).toEqual(['2026-01'])
    })

    it('uses 29 days for February in a leap year', () => {
      // February 2028 has 29 days, so its final 7 days are the 23rd to the 29th.
      expect(completeMonths(['2028-01-01', '2028-02-23'])).toEqual(['2028-01', '2028-02'])
      expect(completeMonths(['2028-01-01', '2028-02-22'])).toEqual(['2028-01'])
    })
  })

  it('counts a middle month that has no transactions', () => {
    expect(completeMonths(['2026-08-02', '2026-08-15', '2026-10-30'])).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('counts a single month when the data covers it from start to end', () => {
    expect(completeMonths(['2026-10-01', '2026-10-31'])).toEqual(['2026-10'])
  })

  it('returns nothing when the data sits in the middle of one month', () => {
    expect(completeMonths(['2026-11-01', '2026-11-03'])).toEqual([])
  })

  it('returns nothing for a single transaction mid-month', () => {
    expect(completeMonths(['2026-10-15'])).toEqual([])
  })

  it('does not depend on the order of the dates', () => {
    const ordered = ['2026-05-01', '2026-06-15', '2026-07-09', '2026-08-20', '2026-10-31']
    const shuffled = ['2026-08-20', '2026-10-31', '2026-05-01', '2026-07-09', '2026-06-15']
    expect(completeMonths(shuffled)).toEqual(completeMonths(ordered))
    expect(completeMonths(shuffled)).toHaveLength(6)
  })

  it('crosses a year boundary in ascending order', () => {
    expect(completeMonths(['2025-11-01', '2026-02-28'])).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })

  it('keeps only the latest 12 months by default', () => {
    // August 2025 to October 2026 is 15 complete months.
    const months = completeMonths(['2025-08-01', '2026-10-31'])
    expect(months).toHaveLength(12)
    expect(MAX_MONTHS).toBe(12)
    expect(months[0]).toBe('2025-11')
    expect(months.at(-1)).toBe('2026-10')
  })

  it('keeps only the latest maxMonths months when given a limit', () => {
    expect(completeMonths(['2026-05-01', '2026-10-31'], 3)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('returns nothing when the limit is zero', () => {
    expect(completeMonths(['2026-05-01', '2026-10-31'], 0)).toEqual([])
  })
})
