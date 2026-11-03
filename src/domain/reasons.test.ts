import { describe, expect, it } from 'vitest'
import { computeMeasures, type Measures } from './measures'
import { topReasons } from './reasons'
import { computeScore } from './score'

/**
 * Measures that score 58, 44, 100, 56 and 86 (the spec example), with any of
 * them overridden. The sub-scores come from the ratios, not from the totals.
 */
function measuresWith(overrides: Partial<Measures> = {}): Measures {
  return {
    months: ['2026-01', '2026-02', '2026-03'],
    monthly: [],
    income: 150_000,
    spending: 90_000,
    essentials: 60_000,
    wants: 30_000,
    debtPayments: 0,
    categoryMonthlyAvg: {},
    savingsRate: 0.07,
    debtRatio: 0,
    wantsShare: 0.38,
    spendingCV: 0.1534,
    bufferMonths: 1.2,
    uncategorisedShare: 0,
    unrecognisedIncomeCount: 0,
    ...overrides,
  }
}

describe('topReasons', () => {
  it('names the three measures with the most points to gain, biggest first', () => {
    const result = computeScore(measuresWith())
    expect(result.lines.map((line) => line.subScore)).toEqual([58, 44, 100, 56, 86])

    const reasons = topReasons(result)
    expect(reasons.map((reason) => reason.measure)).toEqual([
      'emergencySavings',
      'savingsRate',
      'needsWants',
    ])
    expect(reasons.map((reason) => reason.kind)).toEqual(['improve', 'improve', 'improve'])
    // Weight times the distance from 100: 25 x 56, 25 x 42 and 15 x 44.
    expect(reasons.map((reason) => reason.pointsAvailableHundredths)).toEqual([1400, 1050, 660])
  })

  it('leaves out measures that already score 100', () => {
    // Only stability (60) falls short.
    const result = computeScore(
      measuresWith({ savingsRate: 0.2, bufferMonths: 6, wantsShare: 0.2, spendingCV: 0.25 }),
    )
    expect(topReasons(result)).toEqual([
      { measure: 'stability', kind: 'improve', pointsAvailableHundredths: 600 },
    ])
  })

  it('leaves out measures that could not be scored', () => {
    const result = computeScore(measuresWith({ bufferMonths: null }))
    const reasons = topReasons(result)
    expect(reasons.map((reason) => reason.measure)).toEqual([
      'savingsRate',
      'needsWants',
      'stability',
    ])
    // Buffer drops out, so the four scored weights (25 + 20 + 15 + 15 = 75) are scaled to
    // fill 100%: 25 x 42 x 100 / 75 = 1400, 15 x 44 x 100 / 75 = 880, 15 x 14 x 100 / 75 = 280.
    expect(reasons.map((reason) => reason.pointsAvailableHundredths)).toEqual([1400, 880, 280])
  })

  it('agrees with the ledger when a measure drops out', () => {
    const result = computeScore(measuresWith({ bufferMonths: null }))
    // What a line has earned plus what it could still add is its whole share of the 100 points
    // (25 / 75, 15 / 75 and 15 / 75 of 10,000 hundredths), give or take a hundredth of rounding.
    const wholeShare: Record<string, number> = {
      savingsRate: 3333,
      needsWants: 2000,
      stability: 2000,
    }
    const reasons = topReasons(result)
    expect(reasons).toHaveLength(3)
    for (const reason of reasons) {
      const earned = result.lines.find((line) => line.id === reason.measure)?.pointsHundredths
      const share = wholeShare[reason.measure]
      expect(earned).toBeDefined()
      expect(share).toBeDefined()
      expect(
        Math.abs((earned ?? 0) + reason.pointsAvailableHundredths - (share ?? 0)),
      ).toBeLessThanOrEqual(1)
    }
  })

  it('breaks ties in ledger order', () => {
    // Needs vs. wants and stability both score 80 and both weigh 15.
    const result = computeScore(
      measuresWith({ savingsRate: 0.1, bufferMonths: 6, wantsShare: 0.3, spendingCV: 0.175 }),
    )
    expect(result.lines.map((line) => line.subScore)).toEqual([70, 100, 100, 80, 80])
    expect(topReasons(result).map((reason) => reason.measure)).toEqual([
      'savingsRate',
      'needsWants',
      'stability',
    ])
  })

  it('turns into strengths when every scored measure is 80 or more', () => {
    const result = computeScore(
      measuresWith({
        savingsRate: 0.2, // 100
        bufferMonths: 3, // 80
        debtRatio: 0.1, // 90
        wantsShare: 0.3, // 80
        spendingCV: 0.1, // 100
      }),
    )
    expect(result.lines.map((line) => line.subScore)).toEqual([100, 80, 90, 80, 100])

    const reasons = topReasons(result)
    // Highest sub-score first; the two 100s keep ledger order.
    expect(reasons.map((reason) => reason.measure)).toEqual([
      'savingsRate',
      'stability',
      'debtPayments',
    ])
    expect(reasons.map((reason) => reason.kind)).toEqual(['strength', 'strength', 'strength'])
    expect(reasons.map((reason) => reason.pointsAvailableHundredths)).toEqual([0, 0, 200])
  })

  it('has strengths only for the measures that were scored', () => {
    const result = computeScore(
      measuresWith({
        savingsRate: 0.2,
        bufferMonths: null,
        debtRatio: 0,
        wantsShare: 0.2,
        spendingCV: null,
      }),
    )
    expect(topReasons(result).map((reason) => reason.measure)).toEqual([
      'savingsRate',
      'debtPayments',
      'needsWants',
    ])
  })

  it('weighs strengths the way the ledger does when a measure drops out', () => {
    // Buffer and stability are not scored, so the weights 25 + 20 + 15 = 60 fill 100%.
    const result = computeScore(
      measuresWith({
        savingsRate: 0.15, // 85
        bufferMonths: null,
        debtRatio: 0.1, // 90
        wantsShare: 0.3, // 80
        spendingCV: null,
      }),
    )
    expect(result.lines.map((line) => line.subScore)).toEqual([85, null, 90, 80, null])

    const reasons = topReasons(result)
    expect(reasons.map((reason) => reason.measure)).toEqual([
      'debtPayments',
      'savingsRate',
      'needsWants',
    ])
    expect(reasons.map((reason) => reason.kind)).toEqual(['strength', 'strength', 'strength'])
    // 20 x 10 x 100 / 60 = 333.3, 25 x 15 x 100 / 60 = 625, 15 x 20 x 100 / 60 = 500.
    expect(reasons.map((reason) => reason.pointsAvailableHundredths)).toEqual([333, 625, 500])
  })

  it('has no reasons when nothing was scored', () => {
    const empty = computeMeasures({ key: 'mine', transactions: [], emergencySavings: null })
    const result = computeScore(empty)
    expect(result.status).toBe('no_data')
    expect(topReasons(result)).toEqual([])
  })
})
