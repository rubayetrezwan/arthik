// The seven languages Arthik ships in. English is the default and the source text.

export const LOCALE_CODES = ['en', 'bn', 'hi', 'ar', 'zh', 'es', 'fr'] as const

export type LocaleCode = (typeof LOCALE_CODES)[number]

export interface LocaleInfo {
  /** The language's name in its own script, for the language switcher. */
  nativeName: string
  /** The tag given to `Intl` and to `<html lang>`. */
  intl: string
  dir: 'ltr' | 'rtl'
}

export const LOCALES: Record<LocaleCode, LocaleInfo> = {
  en: { nativeName: 'English', intl: 'en', dir: 'ltr' },
  bn: { nativeName: 'বাংলা', intl: 'bn-BD', dir: 'ltr' },
  hi: { nativeName: 'हिन्दी', intl: 'hi-IN', dir: 'ltr' },
  ar: { nativeName: 'العربية', intl: 'ar', dir: 'rtl' },
  zh: { nativeName: '简体中文', intl: 'zh-CN', dir: 'ltr' },
  es: { nativeName: 'Español', intl: 'es', dir: 'ltr' },
  fr: { nativeName: 'Français', intl: 'fr', dir: 'ltr' },
}

export function isLocaleCode(value: string): value is LocaleCode {
  return (LOCALE_CODES as readonly string[]).includes(value)
}
