// Picks practical tips from a person's own numbers (spec 5.5). A tip is an id and
// the numbers to fill into its text; the wording lives in the translations, so no
// number is ever typed into prose. Money is in BDT; the screen converts it.
// Pure: no React, no DOM.

import { ANCHORS, snapNoise } from './anchors'
import { CATEGORIES } from './categories'
import type { Measures } from './measures'
import { topReasons } from './reasons'
import type { MeasureId, ScoreResult } from './score'
import type { CategoryId, Dataset } from './types'

export type TipId =
  | 'start_dps'
  | 'cut_biggest_want'
  | 'avoid_cash_fees'
  | 'save_on_payday'
  | 'debt_highest_interest'
  | 'steady_spending'
  | 'sort_uncategorised'
  | 'check_unrecognised'
  | 'keep_going'

export interface Tip {
  id: TipId
  /**
   * Money is in BDT. A `month` is `YYYY-MM`. A `pct` is a ratio, 0 to 1. A
   * `category` is a category id.
   */
  values: Record<string, number | string>
}

const MAX_TIPS = 4

/** A measure's tip is offered when its sub-score is below this. */
const START_DPS_BELOW = 80
const AVOID_CASH_FEES_BELOW = 80
const CUT_BIGGEST_WANT_BELOW = 80
const DEBT_HIGHEST_INTEREST_BELOW = 70
const STEADY_SPENDING_BELOW = 60

/** The emergency buffer worth aiming for, in months of essentials. */
export const DPS_TARGET_MONTHS = 3
/** The suggested monthly deposit is this share of average income (1 in 20 is 5%). */
const DPS_INCOME_DIVISOR = 20
/** ...rounded to the nearest multiple of this, and never less than one. */
const DPS_STEP = 500

/** Fees are worth a tip from 1 in this many of average monthly income (1%). */
const FEES_INCOME_DIVISOR = 100

const UNCATEGORISED_FROM = 0.1

/**
 * `value` rounded to the nearest `step`, halves up, but never below one `step`. The
 * quotient is snapped first: a converted income that is exactly half way between two
 * steps can come out a hair short of it, and would round down.
 */
function roundedStep(value: number, step: number): number {
  return Math.max(step, Math.floor(snapNoise(value / step) + 0.5) * step)
}

/** Money to the paisa, which clears the float noise left by dividing and multiplying. */
function toPaisa(amount: number): number {
  return Math.round(amount * 100) / 100
}

function startDps(m: Measures, subScore: number): Tip | null {
  if (subScore >= START_DPS_BELOW || m.bufferMonths === null) return null

  const averageEssentials = m.essentials / m.months.length
  // 3 x essentials less what is saved. Savings are known only as months of buffer here,
  // which also keeps them in taka whatever currency they were entered in.
  const gap = toPaisa((DPS_TARGET_MONTHS - m.bufferMonths) * averageEssentials)
  if (gap <= 0) return null

  // Divide rather than multiply by 0.05, which is not exact in binary.
  const monthly = roundedStep(m.income / (DPS_INCOME_DIVISOR * m.months.length), DPS_STEP)
  return { id: 'start_dps', values: { monthly, months: Math.ceil(gap / monthly) } }
}

function avoidCashFees(m: Measures, subScore: number): Tip | null {
  if (subScore >= AVOID_CASH_FEES_BELOW) return null

  const fees = m.categoryMonthlyAvg.fees ?? 0
  const averageIncome = m.income / m.months.length
  if (fees <= 0 || fees * FEES_INCOME_DIVISOR < averageIncome) return null
  return { id: 'avoid_cash_fees', values: { amount: fees } }
}

/** The savings rate that earns full points, from the anchors (20%). */
const FULL_POINTS_SAVINGS_RATE = (ANCHORS.savingsRate.find(([, score]) => score === 100) ?? [0.2])[0]

/**
 * Pay yourself first: the monthly amount that would lift the savings rate to the one that
 * earns full points. `target` is that rate, a ratio. Not offered when spending is above
 * income: with nothing left over, "put this aside first, then spend the rest" cannot be done.
 */
function saveOnPayday(m: Measures, subScore: number): Tip | null {
  if (
    subScore >= 100 ||
    m.savingsRate === null ||
    m.savingsRate < 0 ||
    m.savingsRate >= FULL_POINTS_SAVINGS_RATE
  ) {
    return null
  }
  const averageIncome = m.income / m.months.length
  const amount = toPaisa(averageIncome * (FULL_POINTS_SAVINGS_RATE - m.savingsRate))
  if (!(amount > 0)) return null
  return { id: 'save_on_payday', values: { amount, target: FULL_POINTS_SAVINGS_RATE } }
}

function cutBiggestWant(m: Measures, subScore: number): Tip | null {
  if (subScore >= CUT_BIGGEST_WANT_BELOW) return null

  // Walk the category table so that equal amounts always resolve the same way.
  let biggest: { category: CategoryId; amount: number } | null = null
  for (const { id, group } of CATEGORIES) {
    const amount = m.categoryMonthlyAvg[id] ?? 0
    if (group === 'want' && amount > (biggest?.amount ?? 0)) biggest = { category: id, amount }
  }
  return biggest && { id: 'cut_biggest_want', values: biggest }
}

function debtHighestInterest(m: Measures, subScore: number): Tip | null {
  if (subScore >= DEBT_HIGHEST_INTEREST_BELOW || m.debtRatio === null) return null
  return { id: 'debt_highest_interest', values: { pct: m.debtRatio } }
}

function steadySpending(m: Measures, subScore: number): Tip | null {
  if (subScore >= STEADY_SPENDING_BELOW) return null

  let highest: { month: string; spending: number } | null = null
  for (const { month, spending } of m.monthly) {
    if (highest === null || spending > highest.spending) highest = { month, spending }
  }
  return highest && { id: 'steady_spending', values: { month: highest.month } }
}

/**
 * The measure each rule's tip helps with, so the screen can set a tip beside its reason. The
 * two data checks and keep_going help with no one measure. Kept in step with
 * TIP_FOR_MEASURE below by the tests.
 */
export const TIP_MEASURE: Readonly<Partial<Record<TipId, MeasureId>>> = {
  avoid_cash_fees: 'savingsRate',
  save_on_payday: 'savingsRate',
  start_dps: 'emergencySavings',
  debt_highest_interest: 'debtPayments',
  cut_biggest_want: 'needsWants',
  steady_spending: 'stability',
}

/** The tip each measure can lead to, given its sub-score. */
const TIP_FOR_MEASURE: Record<MeasureId, ((m: Measures, subScore: number) => Tip | null)[]> = {
  savingsRate: [avoidCashFees, saveOnPayday],
  emergencySavings: [startDps],
  debtPayments: [debtHighestInterest],
  needsWants: [cutBiggestWant],
  stability: [steadySpending],
}

function keepGoing(): Tip {
  return { id: 'keep_going', values: {} }
}

/**
 * Two to four tips. First come the tips for the measures with the most to gain,
 * in the order of the reasons, then the two data checks. The checks keep their places:
 * when there are more than four, it is the last of the advice that is left out, never a
 * check on the data the advice rests on. A lone tip is followed by `keep_going` to make two.
 *
 * The one exception is when no rule applies: the result is `keep_going` alone. A
 * person with nothing to fix has nothing to be told, and one encouraging line is
 * more honest than inventing a second.
 *
 * `_ds` is part of the signature so a rule can reach the raw transactions; every
 * rule so far gets what it needs from the measures.
 */
export function pickTips(_ds: Dataset, m: Measures, r: ScoreResult): Tip[] {
  const subScores = new Map(r.lines.map((line) => [line.id, line.subScore]))

  const advice: Tip[] = []
  for (const reason of topReasons(r)) {
    const subScore = subScores.get(reason.measure) ?? null
    if (reason.kind !== 'improve' || subScore === null) continue
    for (const rule of TIP_FOR_MEASURE[reason.measure]) {
      const tip = rule(m, subScore)
      if (tip) advice.push(tip)
    }
  }

  const checks: Tip[] = []
  if (m.uncategorisedShare >= UNCATEGORISED_FROM) {
    checks.push({ id: 'sort_uncategorised', values: { pct: m.uncategorisedShare } })
  }
  if (m.unrecognisedIncomeCount > 0) {
    checks.push({ id: 'check_unrecognised', values: { count: m.unrecognisedIncomeCount } })
  }

  // There are at most two checks, so at least two places are left for advice.
  const tips = [...advice.slice(0, MAX_TIPS - checks.length), ...checks]
  // keep_going is never a rule's own tip, so it cannot appear twice.
  if (tips.length === 0) return [keepGoing()]
  if (tips.length === 1) tips.push(keepGoing())
  return tips
}
