// The made-up numbers that "How the score works" adds up, run through the real scoring
// code so the page can never show a sum the code would not make. They are the example
// from spec 5.4: sub-scores 58, 44, 100, 56 and 86, which add up to 66.80 and score 67.
// Pure: no React, no DOM.

import type { Measures } from '../../domain/measures'
import { computeScore, type ScoreResult } from '../../domain/score'

/**
 * Three complete months in which every measure can be scored. The totals agree with the
 * savings rate (7%) and the share on wants (38%). `computeScore` reads neither the
 * month-by-month figures nor the category averages, so those are left empty.
 */
export const EXAMPLE_MEASURES: Measures = {
  months: ['2026-01', '2026-02', '2026-03'],
  monthly: [],
  income: 150_000,
  spending: 139_500,
  essentials: 86_490,
  wants: 53_010,
  debtPayments: 0,
  categoryMonthlyAvg: {},
  savingsRate: 0.07,
  debtRatio: 0,
  wantsShare: 0.38,
  spendingCV: 0.1534,
  bufferMonths: 1.2,
  uncategorisedShare: 0,
  unrecognisedIncomeCount: 0,
}

/** The example, scored. */
export const EXAMPLE: ScoreResult = computeScore(EXAMPLE_MEASURES)

/** The same example with no emergency savings entered, so that measure is not scored. */
export const EXAMPLE_WITHOUT_SAVINGS: ScoreResult = computeScore({
  ...EXAMPLE_MEASURES,
  bufferMonths: null,
})
