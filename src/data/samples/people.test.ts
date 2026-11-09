import { describe, expect, it } from 'vitest'
import { computeMeasures } from '../../domain/measures'
import { computeScore } from '../../domain/score'
import { PERSON_IDS, SAMPLE_SCORES } from './people'
import { SAMPLES } from './index'

describe('SAMPLE_SCORES', () => {
  it('names a score for each person, in the order they are shown', () => {
    expect(Object.keys(SAMPLE_SCORES)).toEqual([...PERSON_IDS])
  })

  it.each(PERSON_IDS)("is %s's real score, so the home page cannot drift from the data", (id) => {
    const result = computeScore(computeMeasures(SAMPLES[id]))
    expect(result.status).toBe('scored')
    expect(SAMPLE_SCORES[id]).toBe(result.score)
  })
})
