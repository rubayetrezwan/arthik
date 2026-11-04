import { describe, expect, it } from 'vitest'
import { fixtureA } from './fixtures'
import { computeMeasures, type Measures } from './measures'
import {
  BAND_RANGES,
  bandOf,
  computeScore,
  HIGHEST_SCORE,
  MEASURE_IDS,
  WEIGHTS,
  type LedgerLine,
  type MeasureId,
} from './score'
import type { Dataset } from './types'

/** A complete month set with income and spending, so only the overrides change what is scored. */
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

function lineOf(lines: readonly LedgerLine[], id: MeasureId): LedgerLine {
  const line = lines.find((candidate) => candidate.id === id)
  if (!line) throw new Error(`no ledger line for ${id}`)
  return line
}

describe('measure ids and weights', () => {
  it('lists the five measures in ledger order', () => {
    expect(MEASURE_IDS).toEqual([
      'savingsRate',
      'emergencySavings',
      'debtPayments',
      'needsWants',
      'stability',
    ])
  })

  it('weights them 25, 25, 20, 15, 15 percent', () => {
    expect(MEASURE_IDS.map((id) => WEIGHTS[id])).toEqual([25, 25, 20, 15, 15])
  })
})

describe('BAND_RANGES', () => {
  it('lists the three bands with their ranges, lowest first', () => {
    expect(BAND_RANGES).toEqual([
      { band: 'vulnerable', min: 0, max: 39 },
      { band: 'coping', min: 40, max: 79 },
      { band: 'healthy', min: 80, max: 100 },
    ])
  })

  it('runs from 0 to HIGHEST_SCORE, 100, with no gaps', () => {
    expect(HIGHEST_SCORE).toBe(100)
    expect(BAND_RANGES[0]?.min).toBe(0)
    expect(BAND_RANGES.at(-1)?.max).toBe(HIGHEST_SCORE)
    for (let index = 1; index < BAND_RANGES.length; index++) {
      expect(BAND_RANGES[index]?.min).toBe((BAND_RANGES[index - 1]?.max ?? NaN) + 1)
    }
  })

  it('agrees with bandOf for every whole score', () => {
    for (let score = 0; score <= 100; score++) {
      const range = BAND_RANGES.find(({ min, max }) => score >= min && score <= max)
      expect(range?.band, String(score)).toBe(bandOf(score))
    }
  })
})

describe('bandOf', () => {
  it('splits at 40 and 80', () => {
    expect(bandOf(0)).toBe('vulnerable')
    expect(bandOf(39)).toBe('vulnerable')
    expect(bandOf(40)).toBe('coping')
    expect(bandOf(79)).toBe('coping')
    expect(bandOf(80)).toBe('healthy')
    expect(bandOf(100)).toBe('healthy')
  })
})

describe('computeScore: the spec example', () => {
  const result = computeScore(measuresWith())

  it('turns each measure into a whole-number sub-score', () => {
    expect(result.lines.map((line) => line.subScore)).toEqual([58, 44, 100, 56, 86])
  })

  it('keeps the raw values and the ledger order', () => {
    expect(result.lines.map((line) => line.id)).toEqual([...MEASURE_IDS])
    expect(result.lines.map((line) => line.raw)).toEqual([0.07, 1.2, 0, 0.38, 0.1534])
  })

  it('bands each sub-score', () => {
    expect(result.lines.map((line) => line.band)).toEqual([
      'coping',
      'coping',
      'healthy',
      'coping',
      'healthy',
    ])
  })

  it('gives full weights of 25.0, 25.0, 20.0, 15.0 and 15.0 percent', () => {
    expect(result.lines.map((line) => line.weightTenths)).toEqual([250, 250, 200, 150, 150])
  })

  it('has points of sub-score times weight, in hundredths', () => {
    expect(result.lines.map((line) => line.pointsHundredths)).toEqual([1450, 1100, 2000, 840, 1290])
  })

  it('adds up to 66.80, which scores 67 and is Coping', () => {
    expect(result.status).toBe('scored')
    expect(result.totalHundredths).toBe(6680)
    expect(result.score).toBe(67)
    expect(result.band).toBe('coping')
    expect(result.lines.every((line) => line.notScoredReason === null)).toBe(true)
  })

  it('carries the months used', () => {
    expect(result.months).toEqual(['2026-01', '2026-02', '2026-03'])
  })
})

describe('computeScore: sharing out the weight of a measure that is not scored', () => {
  const result = computeScore(measuresWith({ bufferMonths: null }))

  it('shows the effective weights, with 0 for the line that is not scored', () => {
    expect(result.lines.map((line) => line.weightTenths)).toEqual([333, 0, 267, 200, 200])
  })

  it('gives points that add up exactly to the total, using largest-remainder rounding', () => {
    // Exact shares are 1933.33, 2666.67, 1120 and 1720, which floor to 7439. The
    // one hundredth left over goes to the largest remainder (the debt line).
    expect(result.lines.map((line) => line.pointsHundredths)).toEqual([
      1933,
      null,
      2667,
      1120,
      1720,
    ])
    expect(result.totalHundredths).toBe(7440)
    expect(result.score).toBe(74)
    expect(result.band).toBe('coping')
  })

  it('says why the line is not scored, and leaves it out of the sub-scores', () => {
    const emergency = lineOf(result.lines, 'emergencySavings')
    expect(emergency.raw).toBeNull()
    expect(emergency.subScore).toBeNull()
    expect(emergency.band).toBeNull()
    expect(emergency.notScoredReason).toBe('no_savings_given')
  })
})

describe('computeScore: largest-remainder ties', () => {
  it('hands a single leftover hundredth to the earlier line in ledger order', () => {
    // Sub-scores 1, 1 and 0 at weights 25, 25 and 15. Each of the first two
    // gets 38.46, so both floor to 38 with the same remainder; the total is 0.77.
    const result = computeScore(
      measuresWith({
        savingsRate: -0.097,
        bufferMonths: 0.03,
        debtRatio: null,
        wantsShare: null,
        spendingCV: 0.5,
      }),
    )
    expect(result.lines.map((line) => line.subScore)).toEqual([1, 1, null, null, 0])
    expect(result.totalHundredths).toBe(77)
    expect(result.lines.map((line) => line.pointsHundredths)).toEqual([39, 38, null, null, 0])
  })

  it('always adds up exactly, whichever measures are missing', () => {
    const rawSets: Partial<Measures>[] = [
      {},
      { savingsRate: -0.04, bufferMonths: 2.3, debtRatio: 0.17, wantsShare: 0.45, spendingCV: 0.3 },
      { savingsRate: 0.123, bufferMonths: 7, debtRatio: 0.05, wantsShare: 0.22, spendingCV: 0.12 },
      { savingsRate: 0.011, bufferMonths: 0.4, debtRatio: 0.44, wantsShare: 0.58, spendingCV: 0.4 },
    ]
    const keys: (keyof Measures)[] = [
      'savingsRate',
      'bufferMonths',
      'debtRatio',
      'wantsShare',
      'spendingCV',
    ]
    for (const raws of rawSets) {
      for (let missing = 0; missing < 1 << keys.length; missing += 1) {
        const dropped: Partial<Measures> = {}
        keys.forEach((key, index) => {
          if (missing & (1 << index)) Object.assign(dropped, { [key]: null })
        })
        const result = computeScore(measuresWith({ ...raws, ...dropped }))
        if (result.status !== 'scored') continue
        const points = result.lines.flatMap((line) =>
          line.pointsHundredths === null ? [] : [line.pointsHundredths],
        )
        expect(points.reduce((sum, value) => sum + value, 0)).toBe(result.totalHundredths)
      }
    }
  })
})

describe('computeScore: rounding the total to a whole score', () => {
  it('rounds .50 up: 66.50 is 67', () => {
    // Sub-scores 50, 40, 100, 100, 60 give 1250 + 1000 + 2000 + 1500 + 900 = 6650.
    const result = computeScore(
      measuresWith({
        savingsRate: 0.05,
        bufferMonths: 1,
        debtRatio: 0,
        wantsShare: 0.2,
        spendingCV: 0.25,
      }),
    )
    expect(result.lines.map((line) => line.subScore)).toEqual([50, 40, 100, 100, 60])
    expect(result.totalHundredths).toBe(6650)
    expect(result.score).toBe(67)
  })

  it('rounds a sub-score of exactly 37.5 up to 38', () => {
    const result = computeScore(measuresWith({ debtRatio: 0.33 }))
    expect(lineOf(result.lines, 'debtPayments').subScore).toBe(38)
  })

  it('scores a perfect month 100 and a worst case 0', () => {
    const best = computeScore(
      measuresWith({
        savingsRate: 0.3,
        bufferMonths: 12,
        debtRatio: 0,
        wantsShare: 0.1,
        spendingCV: 0.05,
      }),
    )
    expect(best.totalHundredths).toBe(10_000)
    expect(best.score).toBe(100)
    expect(best.band).toBe('healthy')

    const worst = computeScore(
      measuresWith({
        savingsRate: -0.5,
        bufferMonths: 0,
        debtRatio: 0.9,
        wantsShare: 0.9,
        spendingCV: 2,
      }),
    )
    expect(worst.totalHundredths).toBe(0)
    expect(worst.score).toBe(0)
    expect(worst.band).toBe('vulnerable')
  })
})

describe('computeScore: statuses', () => {
  it('is no_data when there are no complete months', () => {
    const empty: Dataset = { key: 'mine', transactions: [], emergencySavings: null }
    const result = computeScore(computeMeasures(empty))
    expect(result.status).toBe('no_data')
    expect(result.score).toBeNull()
    expect(result.band).toBeNull()
    expect(result.totalHundredths).toBeNull()
    expect(result.months).toEqual([])
    expect(result.lines).toHaveLength(5)
  })

  it('is no_income when income is not above 0, even if other measures could be scored', () => {
    const result = computeScore(
      measuresWith({ income: 0, savingsRate: null, debtRatio: null }),
    )
    expect(result.status).toBe('no_income')
    expect(result.score).toBeNull()
    expect(result.band).toBeNull()
    expect(result.totalHundredths).toBeNull()
    expect(lineOf(result.lines, 'savingsRate').notScoredReason).toBe('no_income')
    expect(lineOf(result.lines, 'debtPayments').notScoredReason).toBe('no_income')
    // The measures that can be worked out are still there to show.
    expect(lineOf(result.lines, 'needsWants').subScore).toBe(56)
    expect(lineOf(result.lines, 'stability').subScore).toBe(86)
  })

  it('puts no_income ahead of too_few_measures', () => {
    const result = computeScore(
      measuresWith({
        income: 0,
        savingsRate: null,
        debtRatio: null,
        bufferMonths: null,
        wantsShare: null,
        spendingCV: null,
      }),
    )
    expect(result.status).toBe('no_income')
  })

  it('is too_few_measures when fewer than 3 measures can be scored', () => {
    const result = computeScore(
      measuresWith({ bufferMonths: null, wantsShare: null, spendingCV: null }),
    )
    expect(result.status).toBe('too_few_measures')
    expect(result.score).toBeNull()
    expect(result.band).toBeNull()
    expect(result.totalHundredths).toBeNull()
    expect(result.lines.map((line) => line.subScore)).toEqual([58, null, 100, null, null])
  })

  it('scores with exactly 3 measures', () => {
    const result = computeScore(measuresWith({ bufferMonths: null, spendingCV: null }))
    expect(result.status).toBe('scored')
    expect(result.score).not.toBeNull()
  })

  it('shows no weights or points for lines when there is no overall score', () => {
    const result = computeScore(
      measuresWith({ bufferMonths: null, wantsShare: null, spendingCV: null }),
    )
    expect(result.lines.every((line) => line.weightTenths === 0)).toBe(true)
    expect(result.lines.every((line) => line.pointsHundredths === null)).toBe(true)
  })
})

describe('computeScore: why a measure is not scored', () => {
  it('has no_savings_given when savings are missing but there are essentials', () => {
    const { lines } = computeScore(measuresWith({ bufferMonths: null }))
    const line = lineOf(lines, 'emergencySavings')
    expect(line.notScoredReason).toBe('no_savings_given')
  })

  it('has no_essentials when there are no essentials to compare savings with', () => {
    const line = lineOf(
      computeScore(measuresWith({ bufferMonths: null, essentials: 0, wants: 10_000 })).lines,
      'emergencySavings',
    )
    expect(line.notScoredReason).toBe('no_essentials')
  })

  it('has no_spending for needs vs. wants when there is neither', () => {
    const line = lineOf(
      computeScore(measuresWith({ wantsShare: null, essentials: 0, wants: 0 })).lines,
      'needsWants',
    )
    expect(line.notScoredReason).toBe('no_spending')
  })

  it('has too_few_months for stability under 3 months', () => {
    const line = lineOf(
      computeScore(measuresWith({ spendingCV: null, months: ['2026-01', '2026-02'] })).lines,
      'stability',
    )
    expect(line.notScoredReason).toBe('too_few_months')
  })

  it('has no_spending for stability when 3 months have no average spending', () => {
    const line = lineOf(computeScore(measuresWith({ spendingCV: null })).lines, 'stability')
    expect(line.notScoredReason).toBe('no_spending')
  })

  it('leaves the reason null for a measure that is scored', () => {
    const lines = computeScore(measuresWith()).lines
    expect(lines.map((line) => line.notScoredReason)).toEqual([null, null, null, null, null])
  })
})

describe('computeScore on fixtureA', () => {
  const measures = computeMeasures(fixtureA)
  const result = computeScore(measures)

  it('scores all five measures', () => {
    expect(result.status).toBe('scored')
    expect(result.months).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(result.lines.every((line) => line.notScoredReason === null)).toBe(true)
  })

  it('gives sub-scores that follow from the hand-checked measures', () => {
    // Savings rate 30.1% -> 100. Buffer 2 months -> 60. Debt 9.8% -> 90.
    // Wants 20.7% -> 99. Stability CV 0.0154 -> 100.
    expect(result.lines.map((line) => line.subScore)).toEqual([100, 60, 90, 99, 100])
  })

  it('has points that add up exactly to the total', () => {
    const sum = result.lines.reduce((total, line) => total + (line.pointsHundredths ?? 0), 0)
    expect(sum).toBe(result.totalHundredths)
    expect(result.totalHundredths).toBe(8785)
    expect(result.score).toBe(88)
    expect(result.band).toBe('healthy')
  })
})
