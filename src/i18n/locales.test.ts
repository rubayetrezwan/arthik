import { describe, expect, it } from 'vitest'
import { LOCALE_CODES, LOCALES, isLocaleCode } from './locales'

describe('LOCALES', () => {
  it('lists the seven languages, English first', () => {
    expect(LOCALE_CODES).toEqual(['en', 'bn', 'hi', 'ar', 'zh', 'es', 'fr'])
  })

  it('names each language in its own script', () => {
    expect(LOCALE_CODES.map((l) => LOCALES[l].nativeName)).toEqual([
      'English',
      'বাংলা',
      'हिन्दी',
      'العربية',
      '简体中文',
      'Español',
      'Français',
    ])
  })

  it('makes Arabic the only right-to-left language', () => {
    const rtl = LOCALE_CODES.filter((l) => LOCALES[l].dir === 'rtl')

    expect(rtl).toEqual(['ar'])
  })

  it('gives each language the Intl tag the spec calls for', () => {
    expect(Object.fromEntries(LOCALE_CODES.map((l) => [l, LOCALES[l].intl]))).toEqual({
      en: 'en',
      bn: 'bn-BD',
      hi: 'hi-IN',
      ar: 'ar',
      zh: 'zh-CN',
      es: 'es',
      fr: 'fr',
    })
  })

  it('gives every language an Intl tag the runtime knows', () => {
    for (const l of LOCALE_CODES) {
      expect(Intl.NumberFormat.supportedLocalesOf(LOCALES[l].intl), l).toHaveLength(1)
    }
  })
})

describe('isLocaleCode', () => {
  it('accepts the seven codes and nothing else', () => {
    expect(LOCALE_CODES.every(isLocaleCode)).toBe(true)
    expect(isLocaleCode('de')).toBe(false)
    expect(isLocaleCode('EN')).toBe(false)
    expect(isLocaleCode('')).toBe(false)
    expect(isLocaleCode('toString')).toBe(false)
  })
})
