// Every message file that exists in src/i18n/messages, by language. A language whose file is
// not there yet is undefined, so a test can say so clearly instead of crashing.

import { LOCALE_CODES, type LocaleCode } from '../i18n/locales'

const files = import.meta.glob<Record<string, string>>('../i18n/messages/*.json', {
  eager: true,
  import: 'default',
})

export type MessageMap = Record<string, string>

export const MESSAGE_FILES: Record<LocaleCode, MessageMap | undefined> = Object.fromEntries(
  LOCALE_CODES.map((code) => [code, files[`../i18n/messages/${code}.json`]]),
) as Record<LocaleCode, MessageMap | undefined>

export const EN: MessageMap = MESSAGE_FILES.en ?? {}

/** The languages other than English, which are translations of EN. */
export const TRANSLATED_CODES = LOCALE_CODES.filter((code) => code !== 'en')

/** The message file for a language, or a failure that names the file that is missing. */
export function messagesFor(code: LocaleCode): MessageMap {
  const found = MESSAGE_FILES[code]
  if (!found) throw new Error(`src/i18n/messages/${code}.json does not exist yet`)
  return found
}

/** The [language, messages] pairs that have a file, for guards that check whatever exists. */
export const EXISTING: [LocaleCode, MessageMap][] = LOCALE_CODES.flatMap((code) => {
  const found = MESSAGE_FILES[code]
  return found ? [[code, found] as [LocaleCode, MessageMap]] : []
})

/** Same, without English. */
export const EXISTING_TRANSLATIONS = EXISTING.filter(([code]) => code !== 'en')
