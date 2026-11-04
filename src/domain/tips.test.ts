import { describe, expect, it } from 'vitest'
import { fixtureA, fixtureRates, nusratLike, tx } from './fixtures'
import { computeMeasures, type Measures } from './measures'
import { topReasons } from './reasons'
import { computeScore, MEASURE_IDS } from './score'
import { pickTips, TIP_MEASURE, type Tip, type TipId } from './tips'
import type { Dataset, Transaction } from './types'

const MONTHS = ['2026-01', '2026-02', '2026-03']

/** Three complete months, each built from the month's `YYYY-MM` and its position (0 to 2). */
function threeMonths(
  build: (month: string, index: number) => Transaction[],
  emergencySavings: Dataset['emergencySavings'],
): Dataset {
  return {
    key: 'mine',
    transactions: MONTHS.flatMap((month, index) => build(month, index)),
    emergencySavings,
  }
}

/** A salary in on the 1st and rent out on the 28th, every month. */
function salaried(income: number, rent: number, savings: number | null): Dataset {
  return threeMonths(
    (month) => [tx(`${month}-01`, 'salary', income), tx(`${month}-28`, 'rent', -rent)],
    savings === null ? null : { amount: savings, currency: 'BDT' },
  )
}

/** Every measure scores 100, so there is nothing to improve. */
const healthy: Dataset = threeMonths(
  (month) => [
    tx(`${month}-01`, 'salary', 50_000),
    tx(`${month}-02`, 'rent', -10_000),
    tx(`${month}-10`, 'groceries', -5_000),
    tx(`${month}-28`, 'eating_out', -2_000),
  ],
  { amount: 100_000, currency: 'BDT' },
)

const empty: Dataset = { key: 'mine', transactions: [], emergencySavings: null }

/** Tips for a dataset, with any measure overridden to reach a case the data alone cannot. */
function tipsFor(ds: Dataset, overrides: Partial<Measures> = {}): Tip[] {
  const measures = { ...computeMeasures(ds, fixtureRates), ...overrides }
  return pickTips(ds, measures, computeScore(measures))
}

function idsOf(tips: readonly Tip[]): TipId[] {
  return tips.map((tip) => tip.id)
}

function tipOf(tips: readonly Tip[], id: TipId): Tip | undefined {
  return tips.find((tip) => tip.id === id)
}

describe('nusratLike', () => {
  it('has the numbers its tips are checked against', () => {
    const measures = computeMeasures(nusratLike)
    expect(measures.months).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(measures.income / 3).toBe(23_000)
    expect(measures.essentials / 3).toBe(13_262)
    expect(measures.debtPayments).toBe(0)
    const result = computeScore(measures)
    expect(result.lines.map((line) => line.subScore)).toEqual([60, 44, 100, 57, 100])
    expect(result.score).toBe(70)
  })
})

describe('start_dps', () => {
  it('suggests 5% of income, rounded to the nearest 500, and how long the gap takes', () => {
    // Income 23,000 -> 1,150 -> 1,000. Gap = 3 x 13,262 - 15,900 = 23,886 -> 24 months.
    expect(tipOf(tipsFor(nusratLike), 'start_dps')).toEqual({
      id: 'start_dps',
      values: { monthly: 1_000, months: 24 },
    })
  })

  it.each([
    { income: 25_000, rent: 10_000, monthly: 1_500, months: 20 }, // 1,250 rounds half up
    { income: 24_990, rent: 10_000, monthly: 1_000, months: 30 }, // 1,249.50 rounds down
    { income: 3_000, rent: 1_000, monthly: 500, months: 6 }, // 150 lifts to the 500 minimum
    { income: 40_000, rent: 10_000, monthly: 2_000, months: 15 }, // 30,000 / 2,000 is exact
  ])(
    'with income $income and rent $rent it suggests $monthly a month for $months months',
    ({ income, rent, monthly, months }) => {
      const tips = tipsFor(salaried(income, rent, 0))
      expect(tipOf(tips, 'start_dps')?.values).toEqual({ monthly, months })
    },
  )

  it('rounds a converted income that lands exactly on a half step upwards', () => {
    // 175 EUR a month, entered as 1 + 174, is 25,000 BDT. 25,000 / 20 = 1,250 is exactly
    // half way between 1,000 and 1,500. Converting the two parts leaves the three-month
    // income at 74,999.99999999999, and 74,999.99999999999 / 60 / 500 = 2.4999999999999996.
    const ds = threeMonths(
      (month) => [
        tx(`${month}-01`, 'salary', 1, { currency: 'EUR' }),
        tx(`${month}-02`, 'salary', 174, { currency: 'EUR' }),
        tx(`${month}-28`, 'rent', -12_000),
      ],
      { amount: 0, currency: 'BDT' },
    )
    // The test is only worth anything while the conversion really leaves residue.
    expect(computeMeasures(ds, fixtureRates).income).not.toBe(75_000)
    // Gap = 3 x 12,000 = 36,000 -> 24 months at 1,500.
    expect(tipOf(tipsFor(ds), 'start_dps')?.values).toEqual({ monthly: 1_500, months: 24 })
  })

  it('does not add a month for float noise when the gap is an exact number of months', () => {
    // Gap = 3 x 7,000 - 16,000 = 5,000, exactly 5 months at 1,000. Worked out as
    // (3 - 16,000 / 7,000) x 7,000 in floating point it comes to 5,000.000000000001.
    const tips = tipsFor(salaried(23_000, 7_000, 16_000))
    expect(tipOf(tips, 'start_dps')?.values).toEqual({ monthly: 1_000, months: 5 })
  })

  it('counts savings held in another currency in taka', () => {
    // 100 USD is 12,500 BDT at the fixture rates. Gap = 3 x 12,000 - 12,500 = 23,500.
    const ds: Dataset = {
      ...salaried(23_000, 12_000, null),
      emergencySavings: { amount: 100, currency: 'USD' },
    }
    expect(tipOf(tipsFor(ds), 'start_dps')?.values).toEqual({ monthly: 1_000, months: 24 })
  })

  it('is skipped when the savings already cover three months', () => {
    // A score that disagrees with the measures: 0 months of buffer scored, 3.5 on hand.
    const ds = salaried(23_000, 12_000, 0)
    const measures = computeMeasures(ds)
    const tips = pickTips(ds, { ...measures, bufferMonths: 3.5 }, computeScore(measures))
    expect(idsOf(tips)).toEqual(['keep_going'])
  })

  it('is offered below a buffer sub-score of 80 and not at it', () => {
    // 3 months of buffer scores exactly 80. The savings rate still has room, so
    // the tips are not just the fall-back.
    expect(idsOf(tipsFor(nusratLike, { bufferMonths: 3 }))).not.toContain('start_dps')
    expect(idsOf(tipsFor(nusratLike, { bufferMonths: 2.9 }))).toContain('start_dps')
  })
})

describe('avoid_cash_fees', () => {
  const base = computeMeasures(nusratLike)

  function withFees(fees: number, overrides: Partial<Measures> = {}): Tip[] {
    return tipsFor(nusratLike, {
      categoryMonthlyAvg: { ...base.categoryMonthlyAvg, fees },
      ...overrides,
    })
  }

  it('gives the monthly fees when the savings rate is low', () => {
    expect(tipOf(tipsFor(nusratLike), 'avoid_cash_fees')).toEqual({
      id: 'avoid_cash_fees',
      values: { amount: 262 },
    })
  })

  it('needs fees of at least 1% of income', () => {
    // Income averages 23,000, so 1% is 230.
    expect(idsOf(withFees(230))).toContain('avoid_cash_fees')
    expect(idsOf(withFees(229))).not.toContain('avoid_cash_fees')
    expect(idsOf(withFees(0))).not.toContain('avoid_cash_fees')
  })

  it('is not offered when the savings rate scores 80 or more', () => {
    // 15% is a sub-score of 85.
    expect(idsOf(withFees(262, { savingsRate: 0.15 }))).not.toContain('avoid_cash_fees')
  })
})

describe('cut_biggest_want', () => {
  it('names the want category with the largest monthly average', () => {
    // Eating out is 6,000 a month and shopping 2,000. Rent, at 7,000, is bigger
    // than both but is not a want.
    expect(tipOf(tipsFor(nusratLike), 'cut_biggest_want')).toEqual({
      id: 'cut_biggest_want',
      values: { category: 'eating_out', amount: 6_000 },
    })
  })

  it('is not offered when wants are a small share of spending', () => {
    // fixtureA: wants are 20.7% of essentials plus wants, a sub-score of 99.
    expect(idsOf(tipsFor(fixtureA))).not.toContain('cut_biggest_want')
  })
})

describe('debt_highest_interest', () => {
  it('gives the share of income that goes to debt when the debt score is below 70', () => {
    // 12,000 of a 40,000 salary is 30%, a sub-score of 45.
    const indebted = threeMonths(
      (month) => [
        tx(`${month}-01`, 'salary', 40_000),
        tx(`${month}-02`, 'rent', -10_000),
        tx(`${month}-28`, 'loan_emi', -12_000),
      ],
      { amount: 100_000, currency: 'BDT' },
    )
    expect(tipsFor(indebted)).toEqual([
      { id: 'debt_highest_interest', values: { pct: 0.3 } },
      { id: 'keep_going', values: {} },
    ])
  })

  it('is not offered at a sub-score of 70 or more', () => {
    // fixtureA pays about 9.8% of income to debt, a sub-score of 90.
    expect(idsOf(tipsFor(fixtureA))).not.toContain('debt_highest_interest')
  })
})

describe('steady_spending', () => {
  it('names the month with the highest spending when stability scores below 60', () => {
    // Spending is 28,000, 48,000 and 9,000: a variation of about 0.56.
    const gifts = [20_000, 40_000, 1_000]
    const uneven = threeMonths(
      (month, index) => [
        tx(`${month}-01`, 'salary', 60_000),
        tx(`${month}-15`, 'gifts', -(gifts[index] ?? 0)),
        tx(`${month}-28`, 'rent', -8_000),
      ],
      { amount: 100_000, currency: 'BDT' },
    )
    expect(tipsFor(uneven)).toEqual([
      { id: 'steady_spending', values: { month: '2026-02' } },
      { id: 'keep_going', values: {} },
    ])
  })

  it('is offered below a stability sub-score of 60 and not at it', () => {
    // A variation of 0.25 scores exactly 60, and 0.26 scores 58.
    expect(idsOf(tipsFor(healthy, { spendingCV: 0.25 }))).toEqual(['keep_going'])
    // Months that spend the same: the earliest is named.
    expect(tipsFor(healthy, { spendingCV: 0.26 })).toEqual([
      { id: 'steady_spending', values: { month: '2026-01' } },
      { id: 'keep_going', values: {} },
    ])
  })
})

describe('sort_uncategorised', () => {
  it('appears from 10% of spending being uncategorised', () => {
    const tips = tipsFor(healthy, { uncategorisedShare: 0.1 })
    expect(tips).toEqual([
      { id: 'sort_uncategorised', values: { pct: 0.1 } },
      { id: 'keep_going', values: {} },
    ])
    expect(idsOf(tipsFor(healthy, { uncategorisedShare: 0.0999 }))).toEqual(['keep_going'])
  })
})

describe('check_unrecognised', () => {
  it('counts the money in that was not recognised', () => {
    // fixtureA has one unrecognised payment in March.
    expect(tipOf(tipsFor(fixtureA), 'check_unrecognised')).toEqual({
      id: 'check_unrecognised',
      values: { count: 1 },
    })
  })

  it('is left out when nothing was unrecognised', () => {
    expect(idsOf(tipsFor(nusratLike))).not.toContain('check_unrecognised')
  })
})

describe('pickTips', () => {
  it('follows the order of the reasons, then the two data checks', () => {
    expect(idsOf(tipsFor(nusratLike))).toEqual([
      'start_dps',
      'avoid_cash_fees',
      'cut_biggest_want',
    ])
    expect(idsOf(tipsFor(fixtureA))).toEqual(['start_dps', 'check_unrecognised'])
  })

  it('gives start_dps for fixtureA from its own numbers', () => {
    // Income 51,000 -> 2,550 -> 2,500. Gap = 3 x 23,000 - 46,000 = 23,000 -> 10 months.
    expect(tipOf(tipsFor(fixtureA), 'start_dps')?.values).toEqual({ monthly: 2_500, months: 10 })
  })

  it('keeps at most four, dropping the last', () => {
    const tips = tipsFor(nusratLike, { uncategorisedShare: 0.2, unrecognisedIncomeCount: 2 })
    expect(idsOf(tips)).toEqual([
      'start_dps',
      'avoid_cash_fees',
      'cut_biggest_want',
      'sort_uncategorised',
    ])
  })

  it('falls back to keep_going alone when there is nothing to improve', () => {
    // The one case with a single tip: a person with nothing to fix gets one encouraging line.
    expect(tipsFor(healthy)).toEqual([{ id: 'keep_going', values: {} }])
  })

  it('adds keep_going after a single tip so there are always two', () => {
    const tips = tipsFor(healthy, { unrecognisedIncomeCount: 2 })
    expect(tips).toEqual([
      { id: 'check_unrecognised', values: { count: 2 } },
      { id: 'keep_going', values: {} },
    ])
  })

  it('does not add keep_going when the rules already give two tips', () => {
    const tips = tipsFor(healthy, { uncategorisedShare: 0.4, unrecognisedIncomeCount: 3 })
    expect(idsOf(tips)).not.toContain('keep_going')
  })

  it('still reports the data checks when no measure needs improving', () => {
    const tips = tipsFor(healthy, { uncategorisedShare: 0.4, unrecognisedIncomeCount: 3 })
    expect(idsOf(tips)).toEqual(['sort_uncategorised', 'check_unrecognised'])
  })

  it('gives two to four tips for every dataset, or just keep_going when nothing applies', () => {
    for (const ds of [fixtureA, nusratLike, healthy, empty, salaried(23_000, 12_000, 0)]) {
      const tips = tipsFor(ds)
      expect(tips.length).toBeLessThanOrEqual(4)
      // A lone tip is only ever the "nothing to fix" line.
      expect(tips.length >= 2 || idsOf(tips).join() === 'keep_going').toBe(true)
    }
    expect(idsOf(tipsFor(empty))).toEqual(['keep_going'])
  })

  it('never lists keep_going twice', () => {
    for (const ds of [fixtureA, nusratLike, healthy, empty, salaried(23_000, 12_000, 0)]) {
      expect(idsOf(tipsFor(ds)).filter((id) => id === 'keep_going').length).toBeLessThanOrEqual(1)
    }
  })
})

describe('TIP_MEASURE', () => {
  it('names one tip for each measure, and none for the data checks or keep_going', () => {
    expect(Object.values(TIP_MEASURE).sort()).toEqual([...MEASURE_IDS].sort())
    for (const id of ['sort_uncategorised', 'check_unrecognised', 'keep_going'] as const) {
      expect(TIP_MEASURE[id]).toBeUndefined()
    }
  })

  it('names the measure of the reason each rule tip answers', () => {
    // nusratLike as it is, then with debt payments and swings in spending that need tips too.
    for (const overrides of [{}, { debtRatio: 0.3, spendingCV: 0.4 }, { debtRatio: 0.45 }]) {
      const measures = { ...computeMeasures(nusratLike, fixtureRates), ...overrides }
      const result = computeScore(measures)
      const answered = pickTips(nusratLike, measures, result).flatMap(
        (tip) => TIP_MEASURE[tip.id] ?? [],
      )
      const reasons = topReasons(result).map((reason) => reason.measure)

      expect(answered.length).toBeGreaterThanOrEqual(2)
      expect(answered).toEqual(reasons.filter((measure) => answered.includes(measure)))
    }
  })
})
