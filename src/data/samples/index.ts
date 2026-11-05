// All five sample people at once, checked when this file loads. The app itself never imports
// this file (it would put every sample into one chunk): it uses ./loadSamples. The tests do,
// and importing it also hands the checked data to the loader, so both agree on one object.

import type { Dataset, PersonId } from '../../domain/types'
import arif from './arif.json'
import farhana from './farhana.json'
import { primeSamples } from './loadSamples'
import nusrat from './nusrat.json'
import { parseSample } from './parse'
import rahim from './rahim.json'
import tanvir from './tanvir.json'

export { PERSON_IDS, PERSON_META } from './people'
export { parseSample }

export const SAMPLES: Record<PersonId, Dataset> = {
  nusrat: parseSample('nusrat', nusrat),
  tanvir: parseSample('tanvir', tanvir),
  farhana: parseSample('farhana', farhana),
  arif: parseSample('arif', arif),
  rahim: parseSample('rahim', rahim),
}

primeSamples(SAMPLES)
