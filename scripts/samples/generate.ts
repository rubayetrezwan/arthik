// The five sample people as datasets. Pure and deterministic: the same call always
// gives the same data. scripts/generate-samples.ts writes the result to src/data/samples.

import type { Dataset, PersonId } from '../../src/domain/types'
import { buildDataset } from './engine'
import { ARIF, FARHANA, NUSRAT, RAHIM, TANVIR } from './people'

export function generateAll(): Record<PersonId, Dataset> {
  return {
    nusrat: buildDataset(NUSRAT),
    tanvir: buildDataset(TANVIR),
    farhana: buildDataset(FARHANA),
    arif: buildDataset(ARIF),
    rahim: buildDataset(RAHIM),
  }
}

/** The text of a sample file: two-space indent and a final newline. */
export function serialise(dataset: Dataset): string {
  return `${JSON.stringify(dataset, null, 2)}\n`
}
