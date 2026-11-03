import { describe, expect, it } from 'vitest'
import { fixtureA, fixtureRates, tx } from './fixtures'
import { computeMeasures } from './measures'
import { computeScore } from './score'
import { NO_CHANGE, simulate, sliderLimits, type WhatIf } from './whatif'
import type { Dataset } from './types'

const base = computeMeasures(fixtureA)

function change(overrides: Partial<WhatIf>): WhatIf {
  return { ...NO_CHANGE, ...overrides }
}

describe('NO_CHANGE', () => {
  it('moves nothing', () => {
    expect(NO_CHANGE).toEqual({ cutWantsPct: 0, extraIncomeMonthlyBDT: 0, addSavingsBDT: 0 })
  })
})

describe('sliderLimits', () => {
  it('allows half the average monthly income and six months of essentials', () => {
    // Income 153,000 and essentials 69,000 over 3 months.
    expect(sliderLimits(base)).toEqual({ extraIncomeMaxBDT: 25_500, addSavingsMaxBDT: 138_000 })
  })

  it('rounds down to a whole taka', () => {
    const limits = sliderLimits({ ...base, income: 100_000, essentials: 1_000.3 })
    // 100,000 / 3 / 2 = 16,666.67 and 6 x 1,000.3 / 3 = 2,000.6.
    expect(limits).toEqual({ extraIncomeMaxBDT: 16_666, addSavingsMaxBDT: 2_000 })
  })

  it('is zero when there is no complete month or no income', () => {
    const none = computeMeasures({ key: 'mine', transactions: [], emergencySavings: null })
    expect(sliderLimits(none)).toEqual({ extraIncomeMaxBDT: 0, addSavingsMaxBDT: 0 })
    expect(sliderLimits({ ...base, income: 0, essentials: 0 })).toEqual({
      extraIncomeMaxBDT: 0,
      addSavingsMaxBDT: 0,
    })
  })
})

describe('simulate with no change', () => {
  it('gives the same measures and score as the data as it stands', () => {
    const { measures, result } = simulate(fixtureA, NO_CHANGE)
    expect(measures).toEqual(base)
    expect(result).toEqual(computeScore(base))
  })

  it('does not invent savings that were never entered', () => {
    const noSavings: Dataset = { ...fixtureA, emergencySavings: null }
    const { measures, result } = simulate(noSavings, NO_CHANGE)
    expect(measures.bufferMonths).toBeNull()
    expect(result).toEqual(computeScore(computeMeasures(noSavings)))
  })
})

describe('simulate: cut wants', () => {
  it('scales every want by the percentage and nothing else', () => {
    const { measures } = simulate(fixtureA, change({ cutWantsPct: 50 }))
    expect(measures.wants).toBe(9_000)
    expect(measures.wantsShare).toBe(9_000 / 78_000)
    expect(measures.essentials).toBe(69_000)
    expect(measures.income).toBe(153_000)
    expect(measures.debtPayments).toBe(15_000)
    // The 92,000 of spending falls by the 9,000 cut from wants.
    expect(measures.spending).toBe(83_000)
    expect(measures.categoryMonthlyAvg.eating_out).toBe(3_000)
    expect(measures.categoryMonthlyAvg.rent).toBe(15_000)
  })

  it('cuts by a percentage that is not a round half', () => {
    const { measures } = simulate(fixtureA, change({ cutWantsPct: 10 }))
    expect(measures.wants).toBe(16_200)
  })
})

describe('simulate: extra income', () => {
  it('adds the amount in every complete month', () => {
    const { measures } = simulate(fixtureA, change({ extraIncomeMonthlyBDT: 10_000 }))
    expect(measures.income).toBe(183_000)
    expect(measures.months).toEqual(base.months)
    expect(measures.monthly.map((month) => month.income)).toEqual([60_000, 60_000, 63_000])
    expect(measures.spending).toBe(base.spending)
  })

  it('counts a month only if it was already a complete month', () => {
    // January has a single transaction on the 20th, so it is not complete.
    const partialStart: Dataset = {
      ...fixtureA,
      transactions: [tx('2026-01-20', 'groceries', -100), ...fixtureA.transactions.slice(8)],
    }
    const before = computeMeasures(partialStart)
    expect(before.months).toEqual(['2026-02', '2026-03'])

    const { measures } = simulate(partialStart, change({ extraIncomeMonthlyBDT: 10_000 }))
    expect(measures.months).toEqual(['2026-02', '2026-03'])
    expect(measures.income).toBe(before.income + 20_000)
  })

  it('is not counted as unrecognised income', () => {
    const { measures } = simulate(fixtureA, change({ extraIncomeMonthlyBDT: 10_000 }))
    expect(measures.unrecognisedIncomeCount).toBe(base.unrecognisedIncomeCount)
  })
})

describe('simulate: add to emergency savings', () => {
  it('adds a one-off amount to the buffer', () => {
    // 46,000 + 23,000 is 3 months of the 23,000 average essentials.
    const { measures, result } = simulate(fixtureA, change({ addSavingsBDT: 23_000 }))
    expect(measures.bufferMonths).toBe(3)
    expect(result.lines.find((line) => line.id === 'emergencySavings')?.subScore).toBe(80)
  })

  it('creates the savings when none were entered', () => {
    const noSavings: Dataset = { ...fixtureA, emergencySavings: null }
    expect(computeMeasures(noSavings).bufferMonths).toBeNull()

    const { measures } = simulate(noSavings, change({ addSavingsBDT: 23_000 }))
    expect(measures.bufferMonths).toBe(1)
  })

  it('adds to savings held in another currency, in taka', () => {
    // 100 USD is 12,500 BDT at the fixture rates; 10,500 more makes 23,000.
    const dollars: Dataset = { ...fixtureA, emergencySavings: { amount: 100, currency: 'USD' } }
    const { measures } = simulate(dollars, change({ addSavingsBDT: 10_500 }), fixtureRates)
    expect(measures.bufferMonths).toBeCloseTo(1, 10)
  })
})

describe('simulate: the score', () => {
  it('moves with the sliders', () => {
    expect(simulate(fixtureA, NO_CHANGE).result.score).toBe(88)
    // The buffer goes from 2 months (60) to 3 (80): 20 x 25 more hundredths of a point.
    expect(simulate(fixtureA, change({ addSavingsBDT: 23_000 })).result.score).toBe(93)
  })

  it('never goes down when a slider goes up', () => {
    const limits = sliderLimits(base)
    const points = [0, 10, 25, 50].flatMap((cutWantsPct) =>
      [0, 5_000, 12_000, limits.extraIncomeMaxBDT].flatMap((extraIncomeMonthlyBDT) =>
        [0, 23_000, 69_000, limits.addSavingsMaxBDT].map((addSavingsBDT) => ({
          cutWantsPct,
          extraIncomeMonthlyBDT,
          addSavingsBDT,
        })),
      ),
    )
    const results = points.map((w) => ({
      w,
      total: simulate(fixtureA, w).result.totalHundredths ?? NaN,
    }))

    // Any point with every slider at or above another's must score at least as much.
    for (const lower of results) {
      for (const higher of results) {
        const raised =
          higher.w.cutWantsPct >= lower.w.cutWantsPct &&
          higher.w.extraIncomeMonthlyBDT >= lower.w.extraIncomeMonthlyBDT &&
          higher.w.addSavingsBDT >= lower.w.addSavingsBDT
        if (raised) expect(higher.total).toBeGreaterThanOrEqual(lower.total)
      }
    }
  })
})

describe('simulate leaves the data alone', () => {
  it('does not change the dataset it is given', () => {
    const before = structuredClone(fixtureA)
    simulate(fixtureA, { cutWantsPct: 50, extraIncomeMonthlyBDT: 10_000, addSavingsBDT: 23_000 })
    expect(fixtureA).toEqual(before)
  })

  it('gives the same answer when asked twice', () => {
    const w = { cutWantsPct: 30, extraIncomeMonthlyBDT: 5_000, addSavingsBDT: 10_000 }
    expect(simulate(fixtureA, w)).toEqual(simulate(fixtureA, w))
  })
})
