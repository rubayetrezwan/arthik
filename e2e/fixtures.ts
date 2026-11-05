import { expect, test as base, type Page } from '@playwright/test'

/**
 * `test` with one extra rule for every spec: any console error or uncaught exception on a
 * page the test visited fails the test.
 */
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`)
      })
      page.on('pageerror', (error) => problems.push(`exception: ${error.message}`))
      await use(problems)
      expect(problems, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** The five sample people and the score each is built to land in (Task 9), both ends included. */
export const SAMPLE_RANGES = {
  nusrat: [60, 69],
  tanvir: [70, 79],
  farhana: [25, 39],
  arif: [50, 59],
  rahim: [80, 92],
} as const

export const LOCALES = ['en', 'bn', 'hi', 'ar', 'zh', 'es', 'fr'] as const
export type Locale = (typeof LOCALES)[number]
export const DIRECTION: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  bn: 'ltr',
  hi: 'ltr',
  ar: 'rtl',
  zh: 'ltr',
  es: 'ltr',
  fr: 'ltr',
}

/** What `<html lang>` holds for each language: the tag the app gives to Intl. */
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  bn: 'bn-BD',
  hi: 'hi-IN',
  ar: 'ar',
  zh: 'zh-CN',
  es: 'es',
  fr: 'fr',
}

/** Opens the app at a hash route, in a language, by setting what a returning visitor has stored. */
export async function open(page: Page, route: string, locale: Locale = 'en') {
  await page.addInitScript((code) => {
    try {
      // Only the first time, so a reload keeps whatever the visitor chose since.
      if (localStorage.getItem('arthik.locale') === null) localStorage.setItem('arthik.locale', code)
    } catch {
      // Storage may be unavailable; the app then starts in English.
    }
  }, locale)
  await page.goto(`./#${route}`)
  await page.locator('main').waitFor()
}

type UploadSource = string | { name: string; mimeType: string; buffer: Buffer }

/** Chooses a file on the upload page and submits it. */
export async function uploadFile(page: Page, file: UploadSource) {
  await page.goto('./#/upload')
  await page.locator('input[type="file"]').setInputFiles(file)
  await page.locator('form button[type="submit"]').click()
}

const DIGITS = ['0123456789', '০১২৩৪৫৬৭৮৯', '०१२३४५६७८९', '٠١٢٣٤٥٦٧٨٩']

/** The text of an element read as a whole number, whatever digits the language writes. */
export function asNumber(text: string | null): number {
  let latin = text ?? ''
  for (const digits of DIGITS.slice(1)) {
    for (let i = 0; i < 10; i += 1) latin = latin.replaceAll(digits[i]!, String(i))
  }
  return Number(latin.replace(/\D/g, ''))
}

export const languageSelect = (page: Page) => page.locator('select:has(option[value="bn"])')
export const currencySelect = (page: Page) => page.locator('select:has(option[value="USD"])')
