import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSON_IDS, SAMPLES } from '../data/samples'
import { tx } from '../domain/fixtures'
import { computeMeasures } from '../domain/measures'
import { computeScore } from '../domain/score'
import type { CategoryId, Dataset, PersonId } from '../domain/types'
import { formatNumber } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import { GLOSSARY, type TranslatedLocale } from '../i18n/glossary'
import { LOCALE_CODES, LOCALES, type LocaleCode } from '../i18n/locales'
import enMessages from '../i18n/messages/en.json'
import { routes } from '../routes'
import { PrefsProvider } from '../state/prefs'
import { SessionProvider, useSession } from '../state/session'
import { EXISTING, EXISTING_TRANSLATIONS } from '../test/messageFiles'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

// Counted, to show the score is worked out once per dataset and not on every render.
vi.mock('../domain/measures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/measures')>()
  return { ...actual, computeMeasures: vi.fn(actual.computeMeasures) }
})

const html = document.documentElement

function isPersonId(name: string): name is PersonId {
  return (PERSON_IDS as readonly string[]).includes(name)
}

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
  vi.spyOn(console, 'error')
})

afterEach(() => {
  // A missing message or placeholder value is reported here by react-intl.
  expect(console.error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

function main() {
  return within(screen.getByRole('main'))
}

/**
 * The app at `/score/mine`, with `dataset` already in the session as the visitor's own
 * file, or at a sample's page with `change` applied to its categories first.
 */
function renderScore(
  target: Dataset | PersonId,
  { locale = 'en', change }: { locale?: LocaleCode; change?: [txId: string, c: CategoryId] } = {},
) {
  localStorage.setItem('arthik.locale', locale)
  // As a first visit: the page keeps English until the language asked for has loaded.
  html.lang = 'en'
  html.dir = 'ltr'
  const path = typeof target === 'string' ? `/score/${target}` : '/score/mine'

  /** Sets the session up the way the upload page and the category select will. */
  function Prepare() {
    const { upload, setUpload, overrideCategory } = useSession()
    useEffect(() => {
      if (typeof target !== 'string') setUpload(target)
      if (change) overrideCategory(...change)
    }, [setUpload, overrideCategory])
    // Without the file in the session yet, /score/mine would send the visitor to /upload.
    return typeof target === 'string' || upload ? <Outlet /> : null
  }

  const router = createMemoryRouter([{ element: <Prepare />, children: routes }], {
    initialEntries: [path],
  })
  return render(
    <PrefsProvider>
      <SessionProvider>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </SessionProvider>
    </PrefsProvider>,
  )
}

/** Waits until the language asked for is the one on screen. */
async function languageShown(locale: LocaleCode) {
  await waitFor(() => expect(html.lang).toBe(LOCALES[locale].intl))
}

const AUG_TO_OCT = ['2026-08', '2026-09', '2026-10']

/** Three complete months built from one month's lines. */
function threeMonths(month: (m: string) => Dataset['transactions']): Dataset['transactions'] {
  return AUG_TO_OCT.flatMap(month)
}

const savings = { amount: 30_000, currency: 'BDT' } as const

/** Review Focus 3: datasets at the edges that still reach the screen. */
const EDGE_DATASETS: Record<string, Dataset> = {
  'no income': {
    key: 'mine',
    emergencySavings: savings,
    transactions: threeMonths((m) => [
      tx(`${m}-02`, 'rent', -12_000),
      tx(`${m}-10`, 'groceries', -6_000),
      tx(`${m}-28`, 'eating_out', -2_500),
    ]),
  },
  'one complete month': {
    key: 'mine',
    emergencySavings: savings,
    transactions: [
      tx('2026-10-01', 'salary', 40_000),
      tx('2026-10-03', 'rent', -12_000),
      tx('2026-10-15', 'groceries', -6_000),
      tx('2026-10-29', 'eating_out', -2_500),
    ],
  },
  'zero spending': {
    key: 'mine',
    emergencySavings: savings,
    transactions: threeMonths((m) => [
      tx(`${m}-01`, 'salary', 40_000),
      tx(`${m}-28`, 'savings_deposit', -5_000),
    ]),
  },
  'savings only': {
    key: 'mine',
    emergencySavings: null,
    transactions: threeMonths((m) => [
      tx(`${m}-01`, 'savings_deposit', -5_000),
      tx(`${m}-28`, 'savings_withdrawal', 2_000),
    ]),
  },
  'empty after the period filter': {
    key: 'mine',
    emergencySavings: savings,
    transactions: [
      tx('2026-11-10', 'salary', 40_000),
      tx('2026-11-12', 'groceries', -6_000),
      tx('2026-11-20', 'eating_out', -2_500),
    ],
  },
  'no transactions at all': { key: 'mine', emergencySavings: null, transactions: [] },
}

describe('DashboardPage: a sample person', () => {
  it('names the person, gives the headline, and says which months were used', () => {
    renderScore('nusrat')

    expect(main().getByText('Sample: Nusrat, university student in Dhaka')).toBeInTheDocument()
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent(
      'Getting by, with little left over',
    )
    expect(main().getByText(/^Using 6 complete months: May.+Oct 2026$/)).toBeInTheDocument()
  })

  it('shows the score out of 100, with its band, on the band scale', () => {
    renderScore('nusrat')

    const card = within(main().getByRole('region', { name: 'Financial health score' }))
    expect(card.getByTestId('score')).toHaveTextContent('66')
    expect(card.getByText('out of 100')).toBeInTheDocument()
    expect(
      card.getByText('Managing day to day, but exposed in some areas.').closest('p'),
    ).toHaveTextContent(/^Coping/)
    // The band names and their ranges are written out, not only coloured.
    for (const [band, range] of [
      ['Vulnerable', '0–39'],
      ['Coping', '40–79'],
      ['Healthy', '80–100'],
    ]) {
      expect(card.getByText(range!).closest('li')).toHaveTextContent(`${band}${range}`)
    }
  })

  it('puts the marker on the band scale at the score', () => {
    renderScore('nusrat')

    expect(screen.getByTestId('band-marker').style.insetInlineStart).toBe('calc(66% - 1.5px)')
  })

  it('gives the written summary, with the numbers filled in, and says who wrote it', () => {
    renderScore('nusrat')

    const card = within(main().getByRole('region', { name: 'Financial health score' }))
    const summary = card.getByText(/^You live within your means/)
    expect(summary).toHaveTextContent('you keep 2% of your income')
    // Savings divided by average monthly essentials: months of essentials, not of life.
    expect(summary).toHaveTextContent('would cover about 1.2 months of essentials')
    expect(summary).toHaveTextContent(/Eating out and delivery is the biggest of your wants\.$/)
    expect(card.getByText(/^Summary written with Claude\./)).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'How the score works' })).toHaveAttribute(
      'href',
      '/how-it-works',
    )
  })

  it.each(PERSON_IDS)('fills in every placeholder in the summary for %s', (id) => {
    renderScore(id)

    const card = main().getByRole('region', { name: 'Financial health score' })
    const summary = card.querySelector('[data-summary]')
    // Written to the person, in the second person.
    expect(summary?.textContent).toMatch(/\byou\b/i)
    expect(summary?.textContent).not.toMatch(/[{}]|NaN|—/)
  })

  it.each(PERSON_IDS)('adds up the ledger for %s exactly to the total shown', (id) => {
    renderScore(id)

    const ledger = within(main().getByRole('region', { name: /adds up$/ }))
    const rows = ledger.getAllByRole('row')
    const points = rows
      .slice(1, 6)
      .map((row) => Number(within(row).getAllByRole('cell')[2]?.textContent))
    const total = Number(within(rows[6]!).getByRole('cell').textContent)
    const hundredths = (n: number) => Math.round(n * 100)
    expect(points.reduce((sum, p) => sum + hundredths(p), 0)).toBe(hundredths(total))

    const result = computeScore(computeMeasures(SAMPLES[id]))
    expect(total).toBe((result.totalHundredths ?? NaN) / 100)
    expect(main().getByTestId('score')).toHaveTextContent(String(result.score))
    expect(within(rows[7]!).getByRole('cell')).toHaveTextContent(String(result.score))
  })

  it('has one main heading, and the score sheets under it', () => {
    renderScore('rahim')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(main().getByRole('heading', { level: 2, name: 'Financial health score' }))
      .toBeInTheDocument()
    expect(main().getByRole('heading', { level: 2, name: 'How 89 adds up' })).toBeInTheDocument()
  })

  it('hides the written summary once a category is changed, since it no longer fits', () => {
    const [first] = SAMPLES.nusrat.transactions
    renderScore('nusrat', { change: [first!.id, 'own_transfer'] })

    expect(main().getByText('Sample: Nusrat, university student in Dhaka')).toBeInTheDocument()
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent('Your score')
    expect(main().queryByText(/^You live within your means/)).not.toBeInTheDocument()
    expect(
      main().getByText(
        'You’ve changed some categories, so the written summary is hidden: it describes the transactions as they were.',
      ),
    ).toBeInTheDocument()
  })

  it('works the score out once, not again when the language or currency changes', async () => {
    const user = userEvent.setup()
    renderApp('/score/tanvir')
    expect(main().getByTestId('score')).toHaveTextContent('75')
    vi.mocked(computeMeasures).mockClear()

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    await user.selectOptions(screen.getByLabelText('Language'), 'bn')
    await languageShown('bn')

    expect(main().getByTestId('score')).toHaveTextContent('৭৫')
    expect(computeMeasures).not.toHaveBeenCalled()
  })
})

describe('DashboardPage: your own transactions', () => {
  it('shows a score for a file that has enough in it', () => {
    renderScore(EDGE_DATASETS['one complete month']!)

    expect(main().getByText('Your own transactions')).toBeInTheDocument()
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent('Your score')
    expect(main().getByText('Using 1 complete month: Oct 2026')).toBeInTheDocument()
    expect(main().getByTestId('score')).toBeInTheDocument()
    // Spending stability needs three months, so it is left out and the rest re-weighted.
    expect(main().getByText('Not scored')).toBeInTheDocument()
    expect(main().getByText('Needs at least 3 complete months.')).toBeInTheDocument()
  })

  it('has no written summary', () => {
    renderScore(EDGE_DATASETS['one complete month']!)

    expect(main().queryByText(/^Summary written with Claude/)).not.toBeInTheDocument()
  })

  it('Review Focus 2: data from 1 to 3 November has no complete month, so no score', () => {
    renderScore({
      key: 'mine',
      emergencySavings: savings,
      transactions: [
        tx('2026-11-01', 'salary', 40_000),
        tx('2026-11-02', 'groceries', -1_200),
        tx('2026-11-03', 'eating_out', -450),
      ],
    })

    const notice = within(main().getByRole('region', { name: 'No score yet' }))
    expect(notice.getByText('There isn’t a complete month in these transactions yet.'))
      .toBeInTheDocument()
    expect(
      notice.getByText(
        'A month counts when your transactions cover it: the first month only if they start by day 7, and the last month only if they reach its final 7 days.',
      ),
    ).toBeInTheDocument()
    expect(notice.getByText(/^Your transactions run from/)).toHaveTextContent(
      'Your transactions run from 1 Nov 2026 to 3 Nov 2026.',
    )
    expect(screen.queryByTestId('score')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: /adds up$/ })).not.toBeInTheDocument()
    expect(main().queryByText(/^Using /)).not.toBeInTheDocument()
    // What was read from the file is still there to check.
    expect(screen.getByRole('table', { name: 'Your transactions' })).toBeInTheDocument()
  })

  it('asks for the account income arrives in when the file has no income at all', () => {
    renderScore(EDGE_DATASETS['no income']!)

    expect(
      main().getByText(
        'This file has no income. Add the account your income arrives in to get a score.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('score')).not.toBeInTheDocument()
  })

  it('asks for income transactions when the file has income, but not in the months used', () => {
    renderScore({
      key: 'mine',
      emergencySavings: savings,
      transactions: [
        ...threeMonths((m) => [tx(`${m}-01`, 'rent', -12_000), tx(`${m}-28`, 'groceries', -6_000)]),
        tx('2026-11-02', 'salary', 40_000),
      ],
    })

    expect(main().getByText('Add your income transactions to get a score.')).toBeInTheDocument()
    expect(main().queryByText(/^This file has no income/)).not.toBeInTheDocument()
  })

  it('says which measures could not be worked out when too few can be', () => {
    renderScore(EDGE_DATASETS['zero spending']!)

    const notice = within(main().getByRole('region', { name: 'No score yet' }))
    expect(
      notice.getByText('Only 2 of the 5 measures could be worked out, and a score needs at least 3.'),
    ).toBeInTheDocument()
    const missing = notice.getAllByRole('listitem').map((item) => item.textContent)
    expect(missing).toEqual([
      'Emergency savings: There’s no spending on essentials to measure your savings against.',
      'Needs vs. wants: There’s no spending in these months.',
      'Spending stability: There’s no spending in these months.',
    ])
    expect(screen.queryByTestId('score')).not.toBeInTheDocument()
  })
})

describe('DashboardPage: explore your money', () => {
  /** The headings of the sections under "Explore your money", in order. */
  function sections() {
    const explore = main().getByRole('region', { name: 'Explore your money' })
    return within(explore)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
  }

  it('follows the score sheet with the reasons, the what-if, the charts and the transactions', () => {
    renderScore('nusrat')

    expect(main().getByRole('heading', { level: 2, name: 'Explore your money' }))
      .toBeInTheDocument()
    expect(sections()).toEqual([
      'Why 66, and what would help',
      'What if…',
      'Money in and out, by month',
      'Where the money goes',
      'Your transactions',
    ])
  })

  it('works out the score, the ledger and the reasons again when a category changes', async () => {
    const user = userEvent.setup()
    renderScore('nusrat')
    const [tuition] = screen.getAllByRole('combobox', {
      name: 'Category for Nagad Received 01911xxxxxx - Tuition',
    })

    await user.selectOptions(tuition!, 'own_transfer')

    // October's tuition fee (nusrat-0231) is now money moved between accounts, not income.
    const changed: Dataset = {
      ...SAMPLES.nusrat,
      transactions: SAMPLES.nusrat.transactions.map((t) =>
        t.id === 'nusrat-0231' ? { ...t, category: 'own_transfer' } : t,
      ),
    }
    const score = String(computeScore(computeMeasures(changed)).score)
    expect(score).not.toBe('66')
    expect(main().getByTestId('score')).toHaveTextContent(score)
    expect(main().getByRole('heading', { name: `How ${score} adds up` })).toBeInTheDocument()
    expect(sections()[0]).toBe(`Why ${score}, and what would help`)
    expect(screen.getAllByRole('combobox', { name: /Tuition$/ })[0]).toHaveValue('own_transfer')
    expect(main().queryByText(/^You live within your means/)).not.toBeInTheDocument()
  })

  it('keeps category changes and the score when the currency or language changes, and resets the sliders (Review Focus 5)', async () => {
    const user = userEvent.setup()
    renderApp('/score/nusrat')
    const tuition = () =>
      screen.getAllByRole('combobox', { name: /Nagad Received 01911xxxxxx - Tuition/ })[0]!
    // The first slider is the wants one; position holds in every language.
    const wants = () => screen.getAllByRole('slider')[0]!

    await user.selectOptions(tuition(), 'own_transfer')
    const score = main().getByTestId('score').textContent
    wants().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(wants()).toHaveValue('10')

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    expect(main().getByTestId('score')).toHaveTextContent(score!)
    expect(tuition()).toHaveValue('own_transfer')
    expect(wants()).toHaveValue('0')
    expect(screen.getByRole('slider', { name: 'Extra income each month' }).getAttribute('aria-valuetext'))
      .toMatch(/^\$/)

    wants().focus()
    await user.keyboard('{ArrowRight}')
    await user.selectOptions(screen.getByLabelText('Language'), 'bn')
    await languageShown('bn')
    expect(main().getByTestId('score')).toHaveTextContent(
      formatNumber(Number(score), 'bn'),
    )
    expect(tuition()).toHaveValue('own_transfer')
    expect(wants()).toHaveValue('0')
  })

  it('shows the reasons and the what-if only with a score, but the transactions always (R14)', () => {
    renderScore(EDGE_DATASETS['no income']!)

    expect(sections()).toEqual([
      'Money in and out, by month',
      'Where the money goes',
      'Your transactions',
    ])
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('has nothing to explore without transactions', () => {
    renderScore(EDGE_DATASETS['no transactions at all']!)

    expect(main().queryByRole('region', { name: 'Explore your money' })).not.toBeInTheDocument()
  })
})

describe('Review Focus 3: no broken values reach the screen', () => {
  /** Nor in the words given to screen readers, the slider values or the bar sizes. */
  function expectNoBrokenValues() {
    expect(document.body.textContent).not.toMatch(/NaN|Infinity|undefined|null/)
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/)
  }

  it.each([...PERSON_IDS, 'one complete month'])(
    'moves every slider to its end for "%s" without them',
    async (name) => {
      const user = userEvent.setup()
      renderScore(isPersonId(name) ? name : EDGE_DATASETS[name]!)

      for (const slider of screen.getAllByRole('slider')) {
        if ((slider as HTMLInputElement).disabled) continue
        slider.focus()
        await user.keyboard('{End}')
      }
      expectNoBrokenValues()
      await user.click(screen.getByRole('button', { name: 'Show as table' }))
      expectNoBrokenValues()
    },
  )

  const cases = LOCALE_CODES.flatMap((locale) =>
    Object.keys(EDGE_DATASETS).map((name) => [name, locale] as const),
  )

  it.each(cases)('shows the "%s" file in %s without NaN, Infinity, undefined or null', async (name, locale) => {
    renderScore(EDGE_DATASETS[name]!, { locale })
    await languageShown(locale)

    expect(main().getByRole('heading', { level: 1 })).toBeInTheDocument()
    expectNoBrokenValues()
  })

  it.each(LOCALE_CODES)('shows every sample person in %s without them either', async (locale) => {
    for (const id of PERSON_IDS) {
      const { unmount } = renderScore(id, { locale })
      await languageShown(locale)
      expect(main().getByTestId('score').textContent).not.toBe('')
      expectNoBrokenValues()
      unmount()
    }
  })
})

describe('the sample people’s own words', () => {
  const files = import.meta.glob<Record<string, string>>('../i18n/messages/*.json', {
    eager: true,
    import: 'default',
  })
  const parts = ['kicker', 'headline', 'summary'] as const

  it('exist in English for all five people', () => {
    const en = files['../i18n/messages/en.json'] ?? {}
    for (const id of PERSON_IDS) {
      for (const part of parts) expect(en[`sample.${id}.${part}`], `${id} ${part}`).toBeTruthy()
    }
  })

  it('never say emergency savings would last a time if income stopped (R46)', () => {
    // The measure is savings divided by average monthly essentials: months of essentials.
    const en = files['../i18n/messages/en.json'] ?? {}
    for (const [key, text] of Object.entries(en)) {
      expect(text, key).not.toMatch(/income stopped|would last/i)
    }
  })

  it.each(EXISTING_TRANSLATIONS)(
    'name emergency savings by the glossary term wherever English does, in %s (R46)',
    (code, messages) => {
      // The English wording check cannot run on another language, so every message that names
      // emergency savings must use the agreed term: months of essentials covered.
      const en = files['../i18n/messages/en.json'] ?? {}
      const term = GLOSSARY[code as TranslatedLocale].measures.emergencySavings.toLocaleLowerCase()
      const wrong = Object.entries(en)
        .filter(([, text]) => /emergency savings/i.test(text))
        .filter(([key]) => !(messages[key] ?? '').toLocaleLowerCase().includes(term))
        .map(([key]) => key)
      expect(wrong).toEqual([])
    },
  )

  it.each(Object.keys(files))('carry no typed digit in any script, in %s', (file) => {
    const messages = files[file] ?? {}
    const persona = Object.entries(messages).filter(([key]) =>
      /^sample\.[a-z]+\.(kicker|headline|summary)$/.test(key),
    )
    expect(persona.length).toBeGreaterThan(0)
    for (const [key, text] of persona) {
      // Any decimal digit: 0-9, Bengali, Devanagari, Arabic-Indic and the rest.
      expect(text, key).not.toMatch(/\p{Nd}/u)
    }
  })
})

describe('the explore section’s own words', () => {
  const en: Record<string, string> = enMessages
  const EXPLORE_KEYS = /^(explore|reasons?|tip|whatif|chart|transactions|group|category)\./

  it.each(EXISTING)(
    'carries no typed digit in %s: every number is a placeholder',
    (_code, texts) => {
      const explore = Object.entries(texts).filter(([key]) => EXPLORE_KEYS.test(key))
      expect(explore.length).toBeGreaterThan(100)
      for (const [key, text] of explore) expect(text, key).not.toMatch(/\p{Nd}/u)
    },
  )

  it('spells out the Deposit Pension Scheme wherever it names a DPS', () => {
    for (const [key, text] of Object.entries(en).filter(([key]) => EXPLORE_KEYS.test(key))) {
      if (text.includes('DPS')) expect(text, key).toContain('Deposit Pension Scheme (DPS)')
    }
  })

  it.each(EXISTING_TRANSLATIONS)(
    'spells out the Deposit Pension Scheme as the glossary does in %s',
    (code, texts) => {
      const full = GLOSSARY[code as TranslatedLocale].dps
      for (const key of Object.keys(en).filter((key) => EXPLORE_KEYS.test(key))) {
        if (en[key]?.includes('DPS')) expect(texts[key], key).toContain(full)
      }
    },
  )
})
