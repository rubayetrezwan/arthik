import { useEffect, useState } from 'react'
import { getLoadedSample, loadSample } from '../data/samples/loadSamples'
import type { Dataset, PersonId } from '../domain/types'

export type SampleStatus = 'ready' | 'loading' | 'failed'

/**
 * One sample person's data, fetched the first time it is wanted. Already loaded data is
 * returned on the same render, so going back to a person shows them at once. With no id
 * (the visitor's own file, or a page that shows no person) nothing is loaded.
 */
export function useSample(id: PersonId | null): { dataset: Dataset | null; status: SampleStatus } {
  // The id a failed download was for, so trying another person starts afresh.
  const [failedFor, setFailedFor] = useState<PersonId | null>(null)
  const [, rerender] = useState(0)
  const ready = id === null ? undefined : getLoadedSample(id)

  useEffect(() => {
    if (id === null || getLoadedSample(id)) return
    let live = true
    loadSample(id)
      .then(() => live && rerender((n) => n + 1))
      .catch(() => live && setFailedFor(id))
    return () => {
      live = false
    }
  }, [id])

  if (id === null) return { dataset: null, status: 'ready' }
  if (ready) return { dataset: ready, status: 'ready' }
  return { dataset: null, status: failedFor === id ? 'failed' : 'loading' }
}
