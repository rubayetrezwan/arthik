// Loads the message file for a language. English is bundled with the app. Every other
// language is its own file in ./messages, fetched as a separate chunk the first time that
// language is shown. A language whose file is missing, or fails to load, shows English.

import type { LocaleCode } from './locales'
import en from './messages/en.json'

export type Messages = Record<string, string>

type MessageFiles = Record<string, () => Promise<Messages>>

/** Builds a loader over a map of file path to loader. Tests pass their own map. */
export function createMessageLoader(files: MessageFiles) {
  return async function load(l: LocaleCode): Promise<Messages> {
    const file = l === 'en' ? undefined : files[`./messages/${l}.json`]
    if (!file) return en

    try {
      // English underneath, so a key missing from a translation still shows text.
      return { ...en, ...(await file()) }
    } catch {
      return en
    }
  }
}

export const loadMessages = createMessageLoader(
  import.meta.glob<Messages>(['./messages/*.json', '!./messages/en.json'], {
    import: 'default',
  }),
)
