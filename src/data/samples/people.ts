// Who the five sample people are. Kept apart from the data so the pages that only list
// them (the home page, the switcher) never pull in the transactions.

import type { CurrencyCode, PersonId } from '../../domain/types'

/** The order the people are shown in. */
export const PERSON_IDS: readonly PersonId[] = ['nusrat', 'tanvir', 'farhana', 'arif', 'rahim']

/** The currency each person's figures are shown in to begin with. */
export const PERSON_META: Record<PersonId, { homeCurrency: CurrencyCode }> = {
  nusrat: { homeCurrency: 'BDT' },
  tanvir: { homeCurrency: 'BDT' },
  farhana: { homeCurrency: 'BDT' },
  arif: { homeCurrency: 'GBP' },
  rahim: { homeCurrency: 'SGD' },
}
