import { describe, expect, it } from 'vitest'
import { EXAMPLE, EXAMPLE_MEASURES } from './workedExample'

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0)

describe('the worked example', () => {
  it('has one month-by-month entry for each month, in the same order', () => {
    expect(EXAMPLE_MEASURES.months).toHaveLength(3)
    expect(EXAMPLE_MEASURES.monthly.map((entry) => entry.month)).toEqual(EXAMPLE_MEASURES.months)
  })

  it('has totals that are the sums of the months', () => {
    const { monthly } = EXAMPLE_MEASURES
    expect(EXAMPLE_MEASURES.income).toBe(sum(monthly.map((entry) => entry.income)))
    expect(EXAMPLE_MEASURES.spending).toBe(sum(monthly.map((entry) => entry.spending)))
    expect(EXAMPLE_MEASURES.essentials).toBe(sum(monthly.map((entry) => entry.essentials)))
    expect(EXAMPLE_MEASURES.wants).toBe(sum(monthly.map((entry) => entry.wants)))
    expect(EXAMPLE_MEASURES.debtPayments).toBe(sum(monthly.map((entry) => entry.debt)))
  })

  it('has every month spending its needs plus its wants, and the category averages add up', () => {
    for (const entry of EXAMPLE_MEASURES.monthly) {
      expect(entry.essentials + entry.wants).toBe(entry.spending)
    }
    const perMonth = sum(Object.values(EXAMPLE_MEASURES.categoryMonthlyAvg))
    expect(perMonth * EXAMPLE_MEASURES.months.length).toBeCloseTo(EXAMPLE_MEASURES.spending, 6)
  })

  it('has ratios worked out from those totals', () => {
    const m = EXAMPLE_MEASURES
    expect(m.savingsRate).toBeCloseTo((m.income - m.spending - m.debtPayments) / m.income, 9)
    expect(m.debtRatio).toBeCloseTo(m.debtPayments / m.income, 9)
    expect(m.wantsShare).toBeCloseTo(m.wants / (m.essentials + m.wants), 9)

    const spent = m.monthly.map((entry) => entry.spending)
    const mean = sum(spent) / spent.length
    const sd = Math.sqrt(sum(spent.map((value) => (value - mean) ** 2)) / spent.length)
    expect(m.spendingCV).toBeCloseTo(sd / mean, 9)
  })

  it('has emergency savings of 1.2 months of the average essentials', () => {
    expect(EXAMPLE_MEASURES.bufferMonths).toBeCloseTo(1.2, 9)
    expect(EXAMPLE_MEASURES.essentials / EXAMPLE_MEASURES.months.length).toBeGreaterThan(0)
  })

  it('scores the spec example: sub-scores 58, 44, 100, 56 and 86, total 66.80, score 67', () => {
    expect(EXAMPLE.lines.map((line) => line.subScore)).toEqual([58, 44, 100, 56, 86])
    expect(EXAMPLE.totalHundredths).toBe(6680)
    expect(EXAMPLE.score).toBe(67)
  })
})
