// Picks the measures that best explain a score (spec 5.5): the three with the
// most points still to gain, or, for a person who is doing well everywhere, the
// three that do best. Pure: no React, no DOM.

import { MEASURE_IDS, roundedDivide, WEIGHTS, type MeasureId, type ScoreResult } from './score'

export interface Reason {
  measure: MeasureId
  kind: 'improve' | 'strength'
  /**
   * What the measure could still add to the score, in hundredths of a point: its
   * weight times the sub-score's distance from 100. The weight is the ledger's
   * effective one, so when a measure is not scored the rest are scaled up to fill 100
   * and these numbers still match the ledger.
   */
  pointsAvailableHundredths: number
}

const MAX_REASONS = 3

/** When every scored measure reaches this, there is nothing worth fixing first. */
const STRENGTH_FROM = 80

/**
 * The reasons behind a score, at most three.
 *
 * Normally these are the scored measures below 100, the ones with the most to gain
 * first. If every scored measure is 80 or more they are the three strongest instead.
 * Ties go to the earlier measure in the ledger.
 */
export function topReasons(r: ScoreResult): Reason[] {
  // In ledger order whatever order the lines come in, so the stable sorts below break ties by it.
  const scored = MEASURE_IDS.flatMap((id) => {
    const subScore = r.lines.find((line) => line.id === id)?.subScore ?? null
    return subScore === null ? [] : [{ id, subScore }]
  })

  // The ledger shares 100 points between the measures that were scored (see allocatePoints
  // in score.ts), so a measure's effective weight is its weight over this sum.
  const weightSum = scored.reduce((total, { id }) => total + WEIGHTS[id], 0)

  type Scored = (typeof scored)[number]
  // Ordering uses the plain weight: every effective weight is the same multiple of it,
  // and an exact whole number sorts without any rounding in the way.
  const headroom = ({ id, subScore }: Scored) => WEIGHTS[id] * (100 - subScore)

  const reasonFor =
    (kind: Reason['kind']) =>
    (line: Scored): Reason => ({
      measure: line.id,
      kind,
      // headroom / weightSum x 100 hundredths, in whole numbers so there is no float drift.
      pointsAvailableHundredths: roundedDivide(headroom(line) * 100, weightSum),
    })

  if (scored.every(({ subScore }) => subScore >= STRENGTH_FROM)) {
    return scored
      .sort((a, b) => b.subScore - a.subScore)
      .slice(0, MAX_REASONS)
      .map(reasonFor('strength'))
  }

  return scored
    .filter(({ subScore }) => subScore < 100)
    .sort((a, b) => headroom(b) - headroom(a))
    .slice(0, MAX_REASONS)
    .map(reasonFor('improve'))
}
