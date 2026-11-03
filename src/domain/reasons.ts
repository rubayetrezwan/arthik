// Picks the measures that best explain a score (spec 5.5): the three with the
// most points still to gain, or, for a person who is doing well everywhere, the
// three that do best. Pure: no React, no DOM.

import { MEASURE_IDS, WEIGHTS, type MeasureId, type ScoreResult } from './score'

export interface Reason {
  measure: MeasureId
  kind: 'improve' | 'strength'
  /**
   * What the measure could still add to the score, in hundredths of a point: its
   * weight times the sub-score's distance from 100.
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
 *
 * Points use each measure's usual weight. They are not re-weighted when another
 * measure is not scored, so they can differ a little from the ledger in that case.
 */
export function topReasons(r: ScoreResult): Reason[] {
  // In ledger order whatever order the lines come in, so the stable sorts below break ties by it.
  const scored = MEASURE_IDS.flatMap((id) => {
    const subScore = r.lines.find((line) => line.id === id)?.subScore ?? null
    return subScore === null ? [] : [{ id, subScore }]
  })

  const reasonFor =
    (kind: Reason['kind']) =>
    ({ id, subScore }: { id: MeasureId; subScore: number }): Reason => ({
      measure: id,
      kind,
      pointsAvailableHundredths: WEIGHTS[id] * (100 - subScore),
    })

  if (scored.every(({ subScore }) => subScore >= STRENGTH_FROM)) {
    return scored
      .sort((a, b) => b.subScore - a.subScore)
      .slice(0, MAX_REASONS)
      .map(reasonFor('strength'))
  }

  return scored
    .filter(({ subScore }) => subScore < 100)
    .map(reasonFor('improve'))
    .sort((a, b) => b.pointsAvailableHundredths - a.pointsAvailableHundredths)
    .slice(0, MAX_REASONS)
}
