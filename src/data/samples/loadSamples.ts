// Loads a sample person's transactions the first time they are needed. Each person is a
// separate chunk, so the home page and the other pages never download the five files.

import type { Dataset, PersonId } from '../../domain/types'
import { parseSample } from './parse'

const FILES: Record<PersonId, () => Promise<{ default: unknown }>> = {
  nusrat: () => import('./nusrat.json'),
  tanvir: () => import('./tanvir.json'),
  farhana: () => import('./farhana.json'),
  arif: () => import('./arif.json'),
  rahim: () => import('./rahim.json'),
}

/** Samples whose written summary mentions another person's figures, so both load together. */
const ALSO_NEEDS: Partial<Record<PersonId, PersonId>> = { farhana: 'nusrat' }

const loaded = new Map<PersonId, Dataset>()
const pending = new Map<PersonId, Promise<Dataset>>()

/** The person's data if it has been loaded already, so a page can show it straight away. */
export function getLoadedSample(id: PersonId): Dataset | undefined {
  return loaded.get(id)
}

/** Loads (once) and checks one person's data. A failed load can be tried again. */
export function loadSample(id: PersonId): Promise<Dataset> {
  const ready = loaded.get(id)
  if (ready) return Promise.resolve(ready)

  let promise = pending.get(id)
  if (!promise) {
    const other = ALSO_NEEDS[id]
    promise = Promise.all([FILES[id](), other ? loadSample(other) : undefined])
      .then(([module]) => {
        const dataset = parseSample(id, module.default)
        loaded.set(id, dataset)
        return dataset
      })
      .finally(() => pending.delete(id))
    pending.set(id, promise)
  }
  return promise
}

/** Puts already-checked data in place of a download (the eager `index.ts`, used by tests). */
export function primeSamples(samples: Record<PersonId, Dataset>): void {
  for (const [id, dataset] of Object.entries(samples) as [PersonId, Dataset][]) {
    loaded.set(id, dataset)
  }
}
