// The anchor points behind every sub-score (spec 5.4). Between two anchors the
// score moves in a straight line; beyond the first and last it stays flat.
// Pure: no React, no DOM.

import type { MeasureId } from './score'

/** A raw measure value and the sub-score (0 to 100) it earns. */
export type Anchor = readonly [x: number, score: number]

/** Each list has x ascending. These are the values in the methodology page. */
export const ANCHORS: Record<MeasureId, readonly Anchor[]> = {
  savingsRate: [
    [-0.1, 0],
    [0, 30],
    [0.1, 70],
    [0.2, 100],
  ],
  emergencySavings: [
    [0, 0],
    [1, 40],
    [3, 80],
    [6, 100],
  ],
  debtPayments: [
    [0, 100],
    [0.1, 90],
    [0.2, 70],
    [0.36, 30],
    [0.5, 0],
  ],
  needsWants: [
    [0.2, 100],
    [0.3, 80],
    [0.4, 50],
    [0.6, 0],
  ],
  stability: [
    [0.1, 100],
    [0.25, 60],
    [0.5, 0],
  ],
}

/** The lowest sub-score (and total score); the highest is HIGHEST_SCORE in score.ts. */
export const LOWEST_SCORE = 0

/** Only a savings rate can go below zero; every other measure starts at nothing. */
export const CAN_BE_NEGATIVE: ReadonlySet<MeasureId> = new Set<MeasureId>(['savingsRate'])

/** Float error below this is noise, not a difference in score. */
const SNAP = 1e9

/**
 * `x` to nine decimal places. A value that is exactly on a half can come out a hair
 * below it, and `Math.floor(x + 0.5)` would then round it the wrong way, so snap
 * before rounding.
 */
export function snapNoise(x: number): number {
  return Math.round(x * SNAP) / SNAP
}

/** The score for `x` on the line through `anchors` (x ascending), held flat beyond its ends. */
export function interpolate(x: number, anchors: readonly Anchor[]): number {
  const first = anchors[0]
  if (!first) throw new Error('interpolate needs at least one anchor')
  if (x <= first[0]) return first[1]

  let [x0, y0] = first
  for (const [x1, y1] of anchors.slice(1)) {
    if (x <= x1) {
      const score = y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)
      // A score that is exactly 37.5 can come out as 37.49999999999999, and the
      // sub-score is rounded to a whole number next. Snap so it rounds up as it should.
      return snapNoise(score)
    }
    x0 = x1
    y0 = y1
  }
  return y0
}
