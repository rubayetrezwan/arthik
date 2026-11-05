// The made-up numbers that "How the score works" adds up, run through the real scoring
// code so the page can never show a sum the code would not make. They are the example
// from spec 5.4: sub-scores 58, 44, 100, 56 and 86, which add up to 66.80 and score 67.
// Pure: no React, no DOM.

import { computeMeasures, type Measures } from '../../domain/measures'
import { computeScore, type ScoreResult } from '../../domain/score'
import type { CategoryId, Transaction } from '../../domain/types'

/** The months of the example, and what each spends on the three things that vary. */
const MONTHS = ['2026-01', '2026-02', '2026-03'] as const
const INCOME = 50_000
const RENT = 15_000
const UTILITIES = 5_000
const VARYING: Record<'groceries' | 'eating_out' | 'shopping', readonly [number, number, number]> = {
  groceries: [7_000, 9_000, 10_490],
  eating_out: [6_000, 9_000, 12_000],
  shopping: [5_000, 8_000, 13_010],
}

/** Needs are rent, utilities and groceries; wants are eating out and shopping. */
function transactions(): Transaction[] {
  return MONTHS.flatMap((month, index) => {
    const lines: [day: string, category: CategoryId, amount: number][] = [
      ['01', 'salary', INCOME],
      ['03', 'rent', -RENT],
      ['08', 'utilities', -UTILITIES],
      ['12', 'groceries', -VARYING.groceries[index]!],
      ['18', 'eating_out', -VARYING.eating_out[index]!],
      ['27', 'shopping', -VARYING.shopping[index]!],
    ]
    return lines.map(([day, category, amount]) => ({
      id: `example-${month}-${day}`,
      date: `${month}-${day}`,
      description: category,
      amount,
      currency: 'BDT' as const,
      category,
    }))
  })
}

/**
 * Three complete months in which every measure can be scored, worked out from made-up
 * transactions by the real `computeMeasures`, so every total, ratio and month-by-month
 * figure agrees. Income is 150,000 and spending 139,500 (a savings rate of 7%, 38% of it
 * on wants); emergency savings are 1.2 months of essentials. The first transaction is on
 * the 1st and the last on the 27th, so the first and last months are complete.
 */
export const EXAMPLE_MEASURES: Measures = computeMeasures({
  key: 'mine',
  transactions: transactions(),
  emergencySavings: { amount: 34_596, currency: 'BDT' },
})

/** The example, scored. */
export const EXAMPLE: ScoreResult = computeScore(EXAMPLE_MEASURES)

/** The same example with no emergency savings entered, so that measure is not scored. */
export const EXAMPLE_WITHOUT_SAVINGS: ScoreResult = computeScore({
  ...EXAMPLE_MEASURES,
  bufferMonths: null,
})
