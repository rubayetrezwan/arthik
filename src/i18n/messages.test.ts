// Checks every translation file against English and the glossary. A language whose file does
// not exist yet fails each of its tests with a message that names the missing file.
// Run: npx vitest run src/i18n/messages.test.ts

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { describe, expect, it } from 'vitest'
import { EN, messagesFor, TRANSLATED_CODES, type MessageMap } from '../test/messageFiles'
import {
  BAND_IDS,
  CATEGORY_IDS,
  GLOSSARY,
  GROUP_IDS,
  MEASURE_IDS,
  PROSE_CATEGORY_IDS,
  type TranslatedLocale,
} from './glossary'
import { LOCALE_CODES, LOCALES, type LocaleCode } from './locales'

/* ---------- ICU helpers ---------- */

interface Shape {
  /** Names of every argument and tag, e.g. `count`, `<link>`. */
  names: string[]
  /** For each select argument, its option keywords (these are code, never translated). */
  selects: Record<string, string[]>
  /** Every cardinal plural, with the selectors it offers. */
  plurals: { name: string; selectors: string[] }[]
}

function shapeOf(text: string): Shape {
  const shape: Shape = { names: [], selects: {}, plurals: [] }
  const walk = (elements: MessageFormatElement[]) => {
    for (const element of elements) {
      switch (element.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          shape.names.push(element.value)
          break
        case TYPE.select: {
          shape.names.push(element.value)
          shape.selects[element.value] = Object.keys(element.options).sort()
          for (const option of Object.values(element.options)) walk(option.value)
          break
        }
        case TYPE.plural: {
          shape.names.push(element.value)
          if (element.pluralType === 'cardinal') {
            shape.plurals.push({ name: element.value, selectors: Object.keys(element.options) })
          }
          for (const option of Object.values(element.options)) walk(option.value)
          break
        }
        case TYPE.tag:
          shape.names.push(`<${element.value}>`)
          walk(element.children)
          break
        default:
          break
      }
    }
  }
  walk(parse(text))
  shape.names = [...new Set(shape.names)].sort()
  return shape
}

function parseError(text: string): string | null {
  try {
    parse(text)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Only the keys that parse, so one broken message doesn't hide every other problem. */
function shapes(messages: MessageMap): Map<string, Shape> {
  const result = new Map<string, Shape>()
  for (const [key, text] of Object.entries(messages)) {
    if (parseError(text) === null) result.set(key, shapeOf(text))
  }
  return result
}

const enShapes = shapes(EN)

/* ---------- Allow-lists for values that may equal English ---------- */

/** Nothing to translate: only placeholders and punctuation. Every language may keep these. */
const CODE_ONLY = new Set([
  'band.range',
  'home.samples.entry',
  'howItWorks.example.times',
  'ledger.outOf',
  'noScore.missing',
  'shell.title.pattern',
])

/** The product name stays "Arthik" everywhere except Bengali (আর্থিক, set in the glossary). */
const BRAND_ONLY: Partial<Record<LocaleCode, string[]>> = {
  hi: ['app.name'],
  ar: ['app.name'],
  zh: ['app.name'],
  es: ['app.name'],
  fr: ['app.name'],
}

/** The sample people's names. Latin-script languages keep them; the others transliterate. */
const PERSON_NAMES = ['nusrat', 'tanvir', 'farhana', 'arif', 'rahim'].map(
  (id) => `person.${id}.name`,
)
const PERSON_NAMES_KEPT: Partial<Record<LocaleCode, string[]>> = {
  es: PERSON_NAMES,
  fr: PERSON_NAMES,
}

/** Real words that are spelled the same in English and the language. Add only with a reviewer's OK. */
const COGNATES: Partial<Record<LocaleCode, string[]>> = {
  es: ['home.method.total', 'ledger.total'],
  fr: [
    'home.method.total',
    'ledger.total',
    'ledger.score',
    'ledger.points',
    'transactions.date',
    'transactions.description',
    'howItWorks.bands.scores',
  ],
}

function mayEqualEnglish(code: LocaleCode, key: string): boolean {
  return (
    CODE_ONLY.has(key) ||
    (BRAND_ONLY[code] ?? []).includes(key) ||
    (PERSON_NAMES_KEPT[code] ?? []).includes(key) ||
    (COGNATES[code] ?? []).includes(key)
  )
}

/** Hand-written people's words: these must not carry a number typed in any script. */
const PERSONA_KEY = /^sample\.[a-z]+\.(kicker|headline|summary)$/

/** Keeps `expect(problems).toEqual([])` readable: one line per problem. */
function expectNone(problems: string[]) {
  expect(problems.join('\n')).toBe('')
}

/* ---------- The glossary itself ---------- */

describe('the glossary', () => {
  const enCategoryIds = Object.keys(EN)
    .filter((key) => /^category\.[a-z_]+$/.test(key))
    .map((key) => key.slice('category.'.length))
  const enGroupIds = Object.keys(EN)
    .filter((key) => /^group\.[a-z_]+$/.test(key))
    .map((key) => key.slice('group.'.length))

  it('lists exactly the categories, groups, bands and measures of English', () => {
    expect([...CATEGORY_IDS].sort()).toEqual([...enCategoryIds].sort())
    expect([...GROUP_IDS].sort()).toEqual([...enGroupIds].sort())
    for (const id of BAND_IDS) expect(EN[`band.${id}`], id).toBeTruthy()
    for (const id of MEASURE_IDS) expect(EN[`measure.${id}.name`], id).toBeTruthy()
  })

  it('has a sentence form for exactly the categories whose English label has an ampersand', () => {
    const withAmpersand = CATEGORY_IDS.filter((id) => (EN[`category.${id}`] ?? '').includes('&'))
    expect([...PROSE_CATEGORY_IDS].sort()).toEqual([...withAmpersand].sort())
  })

  it.each(Object.keys(GLOSSARY) as TranslatedLocale[])('is complete and clean in %s', (code) => {
    const glossary = GLOSSARY[code]
    const everyTerm = [
      glossary.arthik,
      glossary.howItWorks,
      glossary.dps,
      ...Object.values(glossary.bands),
      ...Object.values(glossary.measures),
      ...Object.values(glossary.groups),
      ...Object.values(glossary.categories),
      ...Object.values(glossary.categoryProse),
    ]
    for (const term of everyTerm) {
      expect(term.trim(), term).not.toBe('')
      expect(term, term).not.toContain('&')
    }
    // The abbreviation stays, and the savings-deposit label carries the full name.
    expect(glossary.dps).toContain('DPS')
    expect(glossary.categories.savings_deposit).toContain(glossary.dps)
    // One word per band, so the three never read the same.
    expect(new Set(Object.values(glossary.bands)).size).toBe(3)
    // Arthik is written the same way everywhere except Bengali.
    if (code !== 'bn') expect(glossary.arthik).toBe('Arthik')
  })
})

/* ---------- Every message file ---------- */

describe.each(LOCALE_CODES)('messages: %s', (code) => {
  it('has exactly the keys of English', () => {
    const messages = messagesFor(code)
    const missing = Object.keys(EN).filter((key) => !(key in messages))
    const extra = Object.keys(messages).filter((key) => !(key in EN))
    expectNone([
      ...missing.map((key) => `missing: ${key}`),
      ...extra.map((key) => `not in English: ${key}`),
    ])
  })

  it('has only strings, and every message parses as ICU', () => {
    const problems: string[] = []
    for (const [key, text] of Object.entries(messagesFor(code))) {
      if (typeof text !== 'string') problems.push(`${key}: not a string`)
      else {
        const error = parseError(text)
        if (error) problems.push(`${key}: ${error}`)
      }
    }
    expectNone(problems)
  })

  it('uses the same argument and tag names as English, and never translates a select keyword', () => {
    const problems: string[] = []
    for (const [key, shape] of shapes(messagesFor(code))) {
      const en = enShapes.get(key)
      if (!en) continue
      if (shape.names.join(' ') !== en.names.join(' ')) {
        problems.push(
          `${key}: has {${shape.names.join(', ')}}, English has {${en.names.join(', ')}}`,
        )
      }
      for (const [name, keywords] of Object.entries(en.selects)) {
        const own = shape.selects[name]
        if (own?.join(' ') !== keywords.join(' ')) {
          problems.push(
            `${key}: select ${name} offers [${own ?? 'none'}], English has [${keywords}]`,
          )
        }
      }
    }
    expectNone(problems)
  })

  it('writes every plural category the language requires', () => {
    const required = new Intl.PluralRules(LOCALES[code].intl).resolvedOptions().pluralCategories
    const problems: string[] = []
    for (const [key, shape] of shapes(messagesFor(code))) {
      for (const plural of shape.plurals) {
        const absent = required.filter((category) => !plural.selectors.includes(category))
        if (absent.length) {
          problems.push(`${key}: plural ${plural.name} lacks ${absent.join(', ')}`)
        }
      }
      // A plural in English stays a plural, unless the language has only "other" (Chinese).
      const en = enShapes.get(key)
      if (en && required.length > 1) {
        for (const { name } of en.plurals) {
          if (!shape.plurals.some((plural) => plural.name === name)) {
            problems.push(`${key}: ${name} is a plural in English but not here`)
          }
        }
      }
    }
    expectNone(problems)
  })
})

describe.each(TRANSLATED_CODES)('translation: %s', (code) => {
  it('has no empty value and no value left in English', () => {
    const messages = messagesFor(code)
    const problems: string[] = []
    for (const [key, english] of Object.entries(EN)) {
      const text = messages[key]
      if (text === undefined) continue // reported by the key-set test
      if (text.trim() === '') problems.push(`${key}: empty`)
      else if (text.trim() === english.trim() && !mayEqualEnglish(code, key)) {
        problems.push(`${key}: still English`)
      }
    }
    expectNone(problems)
  })

  it('has no number typed in any script in the people’s own words', () => {
    const persona = Object.entries(messagesFor(code)).filter(([key]) => PERSONA_KEY.test(key))
    expect(persona.length).toBeGreaterThan(0)
    // Any decimal digit: 0-9, Bengali, Devanagari, Arabic-Indic and the rest.
    expectNone(
      persona.filter(([, text]) => /\p{Nd}/u.test(text)).map(([key]) => `${key}: has a digit`),
    )
  })

  it('uses the glossary terms for the bands, measures, groups, categories and Arthik', () => {
    const messages = messagesFor(code)
    const glossary = GLOSSARY[code]
    const problems: string[] = []
    const expectTerm = (key: string, term: string) => {
      if (messages[key] !== term)
        problems.push(`${key}: "${messages[key]}", glossary has "${term}"`)
    }
    for (const id of BAND_IDS) expectTerm(`band.${id}`, glossary.bands[id])
    for (const id of MEASURE_IDS) expectTerm(`measure.${id}.name`, glossary.measures[id])
    for (const id of GROUP_IDS) expectTerm(`group.${id}`, glossary.groups[id])
    for (const id of CATEGORY_IDS) expectTerm(`category.${id}`, glossary.categories[id])
    for (const id of PROSE_CATEGORY_IDS)
      expectTerm(`category.${id}.prose`, glossary.categoryProse[id])
    expectTerm('app.name', glossary.arthik)
    expectTerm('howItWorks.title', glossary.howItWorks)
    expectNone(problems)
  })

  it('writes Arthik and the Deposit Pension Scheme as the glossary does, wherever English does', () => {
    const messages = messagesFor(code)
    const glossary = GLOSSARY[code]
    const problems: string[] = []
    for (const [key, english] of Object.entries(EN)) {
      const text = messages[key]
      if (text === undefined) continue
      if (english.includes('Arthik') && !text.includes(glossary.arthik)) {
        problems.push(`${key}: lacks "${glossary.arthik}"`)
      }
      if (english.includes('Deposit Pension Scheme (DPS)') && !text.includes(glossary.dps)) {
        problems.push(`${key}: lacks "${glossary.dps}"`)
      }
    }
    expectNone(problems)
  })

  it('keeps the sentence forms of the categories free of ampersands', () => {
    const prose = Object.entries(messagesFor(code)).filter(([key]) => key.endsWith('.prose'))
    expect(prose.length).toBe(PROSE_CATEGORY_IDS.length)
    expectNone(prose.filter(([, text]) => text.includes('&')).map(([key]) => `${key}: has "&"`))
  })
})
