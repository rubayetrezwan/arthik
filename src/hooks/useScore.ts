import { useMemo } from 'react'
import { computeMeasures, type Measures } from '../domain/measures'
import { computeScore, type ScoreResult } from '../domain/score'
import type { Dataset } from '../domain/types'
import { useActiveDatasetStatus } from '../state/session'
import type { SampleStatus } from '../state/useSample'

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
  return useScoreStatus().scored
}

/** The score, and whether a sample person's data is still being fetched or failed to load. */
export function useScoreStatus(): { scored: Scored | null; status: SampleStatus } {
  const { dataset, status } = useActiveDatasetStatus()

  const scored = useMemo(() => {
    if (!dataset) return null
    const measures = computeMeasures(dataset)
    return { dataset, measures, result: computeScore(measures) }
  }, [dataset])
  return { scored, status }
}
