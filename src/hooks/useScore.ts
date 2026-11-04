import { useMemo } from 'react'
import { computeMeasures, type Measures } from '../domain/measures'
import { computeScore, type ScoreResult } from '../domain/score'
import type { Dataset } from '../domain/types'
import { useActiveDataset } from '../state/session'

export interface Scored {
  dataset: Dataset
  measures: Measures
  result: ScoreResult
}

/**
 * The score of the dataset on screen, or null on a page that shows none.
 *
 * Worked out once per dataset. `useActiveDataset` hands back the same object until the
 * route, the upload or a category change gives a new one, so changing the language or the
 * currency only reformats the result.
 */
export function useScore(): Scored | null {
  const dataset = useActiveDataset()

  return useMemo(() => {
    if (!dataset) return null
    const measures = computeMeasures(dataset)
    return { dataset, measures, result: computeScore(measures) }
  }, [dataset])
}
