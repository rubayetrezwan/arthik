// Turns the five measures into sub-scores, points, a total and a band (spec 5.4).
// Everything that is added up is a whole number of hundredths of a point, so the
// ledger shown on screen adds up exactly. Pure: no React, no DOM.

import { ANCHORS, interpolate } from './anchors'
import { MIN_MONTHS_FOR_CV, type Measures } from './measures'

export type MeasureId =
  | 'savingsRate'
  | 'emergencySavings'
  | 'debtPayments'
  | 'needsWants'
  | 'stability'

/** The ledger order. */
export const MEASURE_IDS: readonly MeasureId[] = [
  'savingsRate',
  'emergencySavings',
  'debtPayments',
  'needsWants',
  'stability',
]

/** Percent of the total each measure is worth when all five are scored. */
export const WEIGHTS: Record<MeasureId, number> = {
  savingsRate: 25,
  emergencySavings: 25,
  debtPayments: 20,
  needsWants: 15,
  stability: 15,
}

export type Band = 'vulnerable' | 'coping' | 'healthy'

/** The top of the scale. Every sub-score and the overall score run from 0 to this. */
export const HIGHEST_SCORE = 100

/** The whole scores each band covers, lowest band first. `bandOf` draws the same lines. */
export const BAND_RANGES: readonly { band: Band; min: number; max: number }[] = [
  { band: 'vulnerable', min: 0, max: 39 },
  { band: 'coping', min: 40, max: 79 },
  { band: 'healthy', min: 80, max: HIGHEST_SCORE },
]

/** 0 to 39 Vulnerable, 40 to 79 Coping, 80 to 100 Healthy. */
export function bandOf(score: number): Band {
  if (score < 40) return 'vulnerable'
  if (score < 80) return 'coping'
  return 'healthy'
}

export type NotScoredReason =
  | 'no_income'
  | 'no_savings_given'
  | 'too_few_months'
  | 'no_spending'
  | 'no_essentials'

export interface LedgerLine {
  id: MeasureId
  /** The measure's own number (a ratio, or months of buffer). Null if it cannot be worked out. */
  raw: number | null
  /** Whole number, 0 to 100. Null if not scored. */
  subScore: number | null
  band: Band | null
  /** Effective weight in tenths of a percent (250 is 25.0%). 0 if not scored. */
  weightTenths: number
  /** subScore times the effective weight, in hundredths of a point. Null if not scored. */
  pointsHundredths: number | null
  notScoredReason: NotScoredReason | null
}

export interface ScoreResult {
  /**
   * `scored` has a total. The other three have none: `no_data` (no complete
   * month), `no_income`, and `too_few_measures` (under 3 measures scored).
   */
  status: 'scored' | 'no_data' | 'no_income' | 'too_few_measures'
  /** Always all five, in ledger order. Weights and points are filled in only when `scored`. */
  lines: LedgerLine[]
  /** Sum of the lines' points, in hundredths. Null unless `scored`. */
  totalHundredths: number | null
  /** The total rounded to a whole number, .50 up. Null unless `scored`. */
  score: number | null
  band: Band | null
  /** The complete months the score is based on. */
  months: string[]
}

/** Fewer scored measures than this and the overall score is not shown. */
export const MIN_SCORED_MEASURES = 3

const RAW_VALUE: Record<MeasureId, (m: Measures) => number | null> = {
  savingsRate: (m) => m.savingsRate,
  emergencySavings: (m) => m.bufferMonths,
  debtPayments: (m) => m.debtRatio,
  needsWants: (m) => m.wantsShare,
  stability: (m) => m.spendingCV,
}

/** Why a measure's raw value is null. Only asked when it is. */
const NOT_SCORED_REASON: Record<MeasureId, (m: Measures) => NotScoredReason> = {
  savingsRate: () => 'no_income',
  debtPayments: () => 'no_income',
  // Measures does not record whether savings were entered. With no essentials the
  // buffer cannot be worked out either way, so that case is reported as no_essentials.
  emergencySavings: (m) => (m.essentials === 0 ? 'no_essentials' : 'no_savings_given'),
  needsWants: () => 'no_spending',
  stability: (m) => (m.months.length < MIN_MONTHS_FOR_CV ? 'too_few_months' : 'no_spending'),
}

/** n / d rounded to the nearest whole number, halves up. Whole numbers only, so no float drift. */
export function roundedDivide(n: number, d: number): number {
  return Math.floor((2 * n + d) / (2 * d))
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** A line with its sub-score but no weight or points yet. */
function lineFor(m: Measures, id: MeasureId): LedgerLine {
  const raw = RAW_VALUE[id](m)
  if (raw === null) {
    return {
      id,
      raw,
      subScore: null,
      band: null,
      weightTenths: 0,
      pointsHundredths: null,
      notScoredReason: NOT_SCORED_REASON[id](m),
    }
  }
  const subScore = Math.round(interpolate(raw, ANCHORS[id]))
  return {
    id,
    raw,
    subScore,
    band: bandOf(subScore),
    weightTenths: 0,
    pointsHundredths: null,
    notScoredReason: null,
  }
}

/**
 * The total in hundredths, and each scored line's points in hundredths, which add
 * up to that total exactly.
 *
 * A line's exact share is subScore x weight x 100 / (sum of scored weights). With
 * all five scored the weights add to 100 and every share is already a whole number.
 * Otherwise shares are fractional: each is floored, and the hundredths left over
 * go one each to the lines with the largest remainders (ties go to the earlier
 * line in the ledger).
 */
function allocatePoints(scored: readonly { id: MeasureId; subScore: number }[]) {
  const weightSum = sum(scored.map(({ id }) => WEIGHTS[id]))
  const shares = scored.map(({ id, subScore }) => {
    const numerator = subScore * WEIGHTS[id] * 100
    const remainder = numerator % weightSum
    return { id, numerator, floor: (numerator - remainder) / weightSum, remainder }
  })

  const totalHundredths = roundedDivide(sum(shares.map(({ numerator }) => numerator)), weightSum)
  // The floors can only fall short of the rounded total, by at most one per line.
  const leftover = totalHundredths - sum(shares.map(({ floor }) => floor))
  // sort is stable, so equal remainders stay in ledger order.
  const gainers = new Set(
    [...shares]
      .sort((a, b) => b.remainder - a.remainder)
      .slice(0, leftover)
      .map(({ id }) => id),
  )

  const lines = new Map(
    shares.map(({ id, floor }) => [
      id,
      {
        pointsHundredths: floor + (gainers.has(id) ? 1 : 0),
        weightTenths: roundedDivide(WEIGHTS[id] * 1000, weightSum),
      },
    ]),
  )
  return { totalHundredths, lines }
}

export function computeScore(m: Measures): ScoreResult {
  const unweighted = MEASURE_IDS.map((id) => lineFor(m, id))
  const scored = unweighted.flatMap(({ id, subScore }) =>
    subScore === null ? [] : [{ id, subScore }],
  )

  const status: ScoreResult['status'] =
    m.months.length === 0
      ? 'no_data'
      : m.income <= 0
        ? 'no_income'
        : scored.length < MIN_SCORED_MEASURES
          ? 'too_few_measures'
          : 'scored'

  if (status !== 'scored') {
    return {
      status,
      lines: unweighted,
      totalHundredths: null,
      score: null,
      band: null,
      months: m.months,
    }
  }

  const { totalHundredths, lines: weighting } = allocatePoints(scored)
  const score = Math.floor((totalHundredths + 50) / 100)
  return {
    status,
    lines: unweighted.map((line) => ({ ...line, ...weighting.get(line.id) })),
    totalHundredths,
    score,
    band: bandOf(score),
    months: m.months,
  }
}
