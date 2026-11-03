// Writes the five sample people to src/data/samples/<name>.json.
// Run with `npm run gen:samples`. The output is the same every time, so a run that
// changes the files means the generator or the categoriser changed.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { generateAll, serialise } from './samples/generate'

const outputDirectory = new URL('../src/data/samples/', import.meta.url)

for (const [id, dataset] of Object.entries(generateAll())) {
  writeFileSync(fileURLToPath(new URL(`${id}.json`, outputDirectory)), serialise(dataset))
  console.log(`${id}.json: ${dataset.transactions.length} transactions`)
}
