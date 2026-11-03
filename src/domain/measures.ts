// Turns a person's transactions into the raw numbers the score is built from
// (spec 5.3 and 5.4). Pure: no React, no DOM.

import { groupOf } from './categories'
import { toBDT, type RatesSnapshot } from './currency'
import { completeMonths, monthOf } from './period'
import type { CategoryId, Dataset, Group } from './types'

/** One complete month, in BDT. Spending and debt are positive amounts. */
export interface MonthTotals {
  month: string
  income: number
  spending: number
  essentials: number
  wants: number
  debt: number
}

export interface Measures {
  /** The complete months used, oldest first. Nothing outside them is counted. */
  months: string[]
  /** BDT, one entry per month in `months`. */
  monthly: MonthTotals[]
  /** BDT totals over the period. */
  income: number
  spending: number
  essentials: number
  wants: number
  debtPayments: number
  /** BDT per month, spending categories only. Refunds are not attributed to a category. */
  categoryMonthlyAvg: Partial<Record<CategoryId, number>>
  /** (income - spending - debt) / income. Null if income is not above 0. */
  savingsRate: number | null
  /** debt / income. Null if income is not above 0. */
  debtRatio: number | null
  /** wants / (essentials + wants). Null if there are neither. */
  wantsShare: number | null
  /** Population SD / mean of monthly spending. Null if under 3 months or no spending. */
  spendingCV: number | null
  /** Emergency savings / average monthly essentials. Null if no savings given or no essentials. */
  bufferMonths: number | null
  /** Uncategorised money out / spending. 0 if there is no spending. */
  uncategorisedShare: number
  /** Money in that was not recognised and defaulted to income, within the period. */
  unrecognisedIncomeCount: number
}

/** Money out in these groups is spending. Debt, savings and not-counted money is not. */
const SPENDING_GROUPS: ReadonlySet<Group> = new Set<Group>([
  'essential',
  'want',
  'other_spending',
  'cash',
  'uncategorised',
])

/** Spending stability needs at least this many months to mean anything. */
export const MIN_MONTHS_FOR_CV = 3

function emptyMonth(month: string): MonthTotals {
  return { month, income: 0, spending: 0, essentials: 0, wants: 0, debt: 0 }
}

/**
 * Standard deviation divided by mean, using the population standard deviation
 * (divide by n) because the months are the whole period, not a sample of it.
 */
function coefficientOfVariation(values: readonly number[]): number | null {
  if (values.length < MIN_MONTHS_FOR_CV) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  if (mean <= 0) return null
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance) / mean
}

export function computeMeasures(ds: Dataset, rates?: RatesSnapshot): Measures {
  const months = completeMonths(ds.transactions.map((transaction) => transaction.date))
  const monthly = months.map(emptyMonth)
  const byMonth = new Map(monthly.map((totals) => [totals.month, totals]))

  const categoryTotals: Partial<Record<CategoryId, number>> = {}
  let uncategorisedSpending = 0
  let unrecognisedIncomeCount = 0

  for (const transaction of ds.transactions) {
    const totals = byMonth.get(monthOf(transaction.date))
    if (!totals) continue // Outside the complete months.

    const amount = toBDT(transaction.amount, transaction.currency, rates)
    const group = groupOf(transaction.category)

    if (transaction.unrecognisedIncome) unrecognisedIncomeCount += 1

    if (group === 'income') {
      totals.income += amount
    } else if (group === 'debt') {
      totals.debt -= amount
    } else if (group === 'refund') {
      // Money back reduces spending. It is not income and has no category of its own here.
      totals.spending -= amount
    } else if (SPENDING_GROUPS.has(group)) {
      const outflow = -amount
      totals.spending += outflow
      if (group === 'essential') totals.essentials += outflow
      if (group === 'want') totals.wants += outflow
      if (group === 'uncategorised') uncategorisedSpending += outflow
      categoryTotals[transaction.category] = (categoryTotals[transaction.category] ?? 0) + outflow
    }
    // Savings and not-counted money (own transfers, loans received...) are ignored.
  }

  const sumOf = (field: Exclude<keyof MonthTotals, 'month'>) =>
    monthly.reduce((sum, totals) => sum + totals[field], 0)
  const income = sumOf('income')
  const spending = sumOf('spending')
  const essentials = sumOf('essentials')
  const wants = sumOf('wants')
  const debtPayments = sumOf('debt')

  const categoryMonthlyAvg: Partial<Record<CategoryId, number>> = {}
  for (const [category, total] of Object.entries(categoryTotals) as [CategoryId, number][]) {
    categoryMonthlyAvg[category] = total / months.length
  }

  const averageEssentials = months.length > 0 ? essentials / months.length : 0
  const bufferMonths =
    ds.emergencySavings && averageEssentials > 0
      ? toBDT(ds.emergencySavings.amount, ds.emergencySavings.currency, rates) / averageEssentials
      : null

  return {
    months,
    monthly,
    income,
    spending,
    essentials,
    wants,
    debtPayments,
    categoryMonthlyAvg,
    savingsRate: income > 0 ? (income - spending - debtPayments) / income : null,
    debtRatio: income > 0 ? debtPayments / income : null,
    wantsShare: essentials + wants > 0 ? wants / (essentials + wants) : null,
    spendingCV: coefficientOfVariation(monthly.map((totals) => totals.spending)),
    bufferMonths,
    uncategorisedShare: spending > 0 ? uncategorisedSpending / spending : 0,
    unrecognisedIncomeCount,
  }
}
