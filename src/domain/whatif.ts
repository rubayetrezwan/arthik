// The "what if" sliders (spec 5.7): change a copy of the person's data, then score
// the copy. The data itself is never touched. Pure: no React, no DOM.

import { groupOf } from './categories'
import { toBDT, type RatesSnapshot } from './currency'
import { computeMeasures, type Measures } from './measures'
import { completeMonths } from './period'
import { computeScore, type ScoreResult } from './score'
import type { Dataset, Transaction } from './types'

export interface WhatIf {
  /** Percent of wants spending to cut, 0 to 50 on the slider. */
  cutWantsPct: number
  /** BDT added to income in every complete month. */
  extraIncomeMonthlyBDT: number
  /** BDT added once to the emergency savings. */
  addSavingsBDT: number
}

export const NO_CHANGE: WhatIf = Object.freeze({
  cutWantsPct: 0,
  extraIncomeMonthlyBDT: 0,
  addSavingsBDT: 0,
})

/** Extra income can go up to this share of average monthly income. */
const EXTRA_INCOME_SHARE_DIVISOR = 2
/** Added savings can go up to this many months of essentials. */
const ADD_SAVINGS_MAX_MONTHS = 6

/**
 * The top of the extra-income and added-savings sliders, in whole BDT. Both are
 * zero when there is no complete month to average over.
 */
export function sliderLimits(m: Measures): { extraIncomeMaxBDT: number; addSavingsMaxBDT: number } {
  const months = m.months.length
  if (months === 0) return { extraIncomeMaxBDT: 0, addSavingsMaxBDT: 0 }
  return {
    extraIncomeMaxBDT: Math.max(0, Math.floor(m.income / (EXTRA_INCOME_SHARE_DIVISOR * months))),
    addSavingsMaxBDT: Math.max(0, Math.floor((ADD_SAVINGS_MAX_MONTHS * m.essentials) / months)),
  }
}

/**
 * Scores the data as it would be with the changes in `w`. Keep `w` within the
 * slider limits: a cut of 0 to 100 percent and amounts of zero or more.
 *
 * - Every want is scaled down by the cut.
 * - Each complete month gets one extra income payment on the 15th.
 * - The added savings go on top of the savings entered, or become the savings if
 *   none were entered. Either way the result is held in BDT.
 *
 * `ds` is not changed.
 */
export function simulate(
  ds: Dataset,
  w: WhatIf,
  rates?: RatesSnapshot,
): { measures: Measures; result: ScoreResult } {
  const kept = 100 - w.cutWantsPct
  const transactions: Transaction[] = ds.transactions.map((transaction) =>
    w.cutWantsPct > 0 && groupOf(transaction.category) === 'want'
      ? // Multiply before dividing so a round cut gives a round amount.
        { ...transaction, amount: (transaction.amount * kept) / 100 }
      : transaction,
  )

  if (w.extraIncomeMonthlyBDT > 0) {
    // The same months computeMeasures uses. A payment on the 15th is inside the
    // span of the data for each of them, so it never changes which months those are.
    for (const month of completeMonths(ds.transactions.map((transaction) => transaction.date))) {
      transactions.push({
        id: `whatif-income-${month}`,
        date: `${month}-15`,
        description: 'What-if extra income',
        amount: w.extraIncomeMonthlyBDT,
        currency: 'BDT',
        category: 'other_income',
      })
    }
  }

  const { emergencySavings } = ds
  const savedBDT = emergencySavings
    ? toBDT(emergencySavings.amount, emergencySavings.currency, rates)
    : 0

  const measures = computeMeasures(
    {
      key: ds.key,
      transactions,
      emergencySavings:
        w.addSavingsBDT > 0
          ? { amount: savedBDT + w.addSavingsBDT, currency: 'BDT' }
          : emergencySavings,
    },
    rates,
  )
  return { measures, result: computeScore(measures) }
}
