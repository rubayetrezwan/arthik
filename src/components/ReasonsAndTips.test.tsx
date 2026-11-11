import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CATEGORIES } from '../domain/categories'
import { convert } from '../domain/currency'
import type { Measures } from '../domain/measures'
import { computeScore } from '../domain/score'
import type { Dataset } from '../domain/types'
import { formatMoney } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import en from '../i18n/messages/en.json'
import { PrefsProvider } from '../state/prefs'
import { ReasonsAndTips } from './ReasonsAndTips'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.spyOn(console, 'error')
})

/**
 * The spec's worked example (spec 5.4 and the mockup): sub-scores 58, 44, 100, 56 and 86,
 * for a person with 23,000 a month coming in, 1,610 a month kept and 15,900 in savings.
 */
function specExample(overrides: Partial<Measures> = {}): Measures {
  return {
    months: ['2026-08', '2026-09', '2026-10'],
    monthly: [],
    income: 69_000,
    spending: 64_170,
    essentials: 39_750,
    wants: 24_363,
    debtPayments: 0,
    categoryMonthlyAvg: { rent: 5_500, eating_out: 3_850, shopping: 2_140, fees: 260 },
    savingsRate: 0.07,
    debtRatio: 0,
    wantsShare: 0.38,
    spendingCV: 0.1534,
    bufferMonths: 1.2,
    uncategorisedShare: 0,
    unrecognisedIncomeCount: 0,
    ...overrides,
  }
}

const withSavings: Dataset = {
  key: 'mine',
  transactions: [],
  emergencySavings: { amount: 15_900, currency: 'BDT' },
}

function renderReasons(measures: Measures, dataset: Dataset = withSavings) {
  return render(
    <PrefsProvider>
      <I18nProvider>
        <ReasonsAndTips dataset={dataset} measures={measures} result={computeScore(measures)} />
      </I18nProvider>
    </PrefsProvider>,
  )
}

/** The numbered reasons, in order. */
function reasons() {
  return within(screen.getByRole('list', { name: /^Why/ })).getAllByRole('listitem')
}

describe('ReasonsAndTips: the spec example', () => {
  it('lists Emergency savings first, worth up to 14 more points', () => {
    renderReasons(specExample())

    const [first] = reasons()
    expect(within(first!).getByRole('heading', { level: 4 })).toHaveTextContent('Emergency savings')
    expect(first).toHaveTextContent('Worth up to 14 more points')
  })

  it('is titled with the score, and lists the three measures with the most to gain', () => {
    renderReasons(specExample())

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(
      'Why 67, and what would help',
    )
    expect(reasons().map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'Emergency savings',
      'Savings rate',
      'Needs vs. wants',
    ])
    expect(reasons().map((item) => within(item).getByText(/^Worth up to/).textContent)).toEqual([
      'Worth up to 14 more points',
      'Worth up to 10.5 more points',
      'Worth up to 6.6 more points',
    ])
  })

  it('states each person’s own number and the benchmark', () => {
    renderReasons(specExample())

    const [emergency, savingsRate, needsWants] = reasons()
    expect(emergency).toHaveTextContent(
      'Your ৳15,900 in savings would cover about 1.2 months of essentials. Covering 3 months scores 80 out of 100, and 6 months scores 100.',
    )
    expect(savingsRate).toHaveTextContent(
      'You kept ৳1,610 a month, 7% of your income. Keeping 20% or more scores 100.',
    )
    expect(needsWants).toHaveTextContent(
      '38% of your spending went on wants. Keeping wants to 20% or less scores 100.',
    )
  })

  it('sets each reason beside the tip that answers it', () => {
    renderReasons(specExample())

    const [emergency, savingsRate, needsWants] = reasons()
    expect(within(emergency!).getByText('What would help').parentElement).toHaveTextContent(
      'Saving an extra ৳1,000 a month, for example in a Deposit Pension Scheme (DPS), would build your emergency savings to 3 months of essentials in about 24 months.',
    )
    expect(savingsRate).toHaveTextContent(
      'Fees and charges averaged ৳260 a month. Paying shops straight from your mobile wallet or card, instead of cashing out first, avoids cash-out charges.',
    )
    // A tip about wants names the whole category its amount is for.
    expect(needsWants).toHaveTextContent(
      'Eating out and delivery averaged ৳3,850 a month, the biggest of your wants.',
    )
    expect(screen.queryByText('Also worth doing')).not.toBeInTheDocument()
  })

  it('shows the amounts in the display currency', () => {
    localStorage.setItem('arthik.currency', 'USD')
    renderReasons(specExample())

    const usd = (bdt: number) => formatMoney(convert(bdt, 'BDT', 'USD'), 'USD', 'en')
    const [emergency, savingsRate, needsWants] = reasons()
    expect(emergency).toHaveTextContent(`Your ${usd(15_900)} in savings`)
    expect(emergency).toHaveTextContent(`Saving an extra ${usd(1_000)} a month`)
    expect(savingsRate).toHaveTextContent(`You kept ${usd(1_610)} a month`)
    expect(needsWants).toHaveTextContent(`averaged ${usd(3_850)} a month`)
  })

  it('reports no missing message or value', () => {
    renderReasons(specExample())

    expect(console.error).not.toHaveBeenCalled()
  })

  it('writes "and", never "&", in a tip sentence, whichever category it names', () => {
    const wants = CATEGORIES.filter(({ group }) => group === 'want').map(({ id }) => id)
    expect(wants.length).toBeGreaterThan(0)
    for (const id of wants) {
      const { unmount } = renderReasons(
        specExample({ categoryMonthlyAvg: { [id]: 3_850, fees: 260 } }),
      )
      const text = screen.getByRole('list', { name: /^Why/ }).textContent ?? ''
      expect(text, id).toContain('averaged')
      expect(text, id).not.toContain('&')
      unmount()
    }
  })
})

describe('the prose category names', () => {
  const messages: Record<string, string> = en

  it('exist for exactly the categories whose label has an ampersand, and have none', () => {
    for (const { id } of CATEGORIES) {
      const label = messages[`category.${id}`] ?? ''
      const prose = messages[`category.${id}.prose`]
      if (label.includes('&')) {
        expect(prose, id).toBeTruthy()
        expect(prose, id).not.toContain('&')
        expect(prose, id).toContain(' and ')
      } else {
        expect(prose, id).toBeUndefined()
      }
    }
  })
})

describe('ReasonsAndTips: save on payday', () => {
  it('sits beside the savings rate with the amount and the rate it would bring', () => {
    renderReasons(specExample())

    const savingsRate = reasons().find(
      (item) => within(item).queryByRole('heading', { name: 'Savings rate' }) !== null,
    )
    // Income averages 23,000 a month and 7% is saved: 13% of 23,000 is 2,990.
    expect(savingsRate).toHaveTextContent(
      'Each month, put ৳2,990 aside on the day your income arrives, then spend only what is left. Spending that much less would bring your savings rate to 20%.',
    )
  })
})

describe('ReasonsAndTips: reasons without a tip, and tips without a reason', () => {
  it('leaves a reason with no tip on its own', () => {
    // Saving 20% earns full points, so the savings rate is no reason. Spending stability is
    // fine (no tip below 60), so it is named as a reason with nothing to help it.
    renderReasons(specExample({ savingsRate: 0.2, categoryMonthlyAvg: { eating_out: 3_850, fees: 100 } }))

    const stability = reasons().find(
      (item) => within(item).queryByRole('heading', { name: 'Spending stability' }) !== null,
    )
    expect(stability).toBeDefined()
    expect(within(stability!).queryByText('What would help')).not.toBeInTheDocument()
  })

  it('lists the data checks after the reasons, as also worth doing', () => {
    renderReasons(
      specExample({
        savingsRate: 0.2,
        categoryMonthlyAvg: { eating_out: 3_850, fees: 100 },
        uncategorisedShare: 0.2,
        unrecognisedIncomeCount: 1,
      }),
    )

    const more = within(screen.getByRole('list', { name: 'Also worth doing' }))
    expect(more.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '20% of your spending has no category yet. Choosing categories for it in the table below gives a more accurate score.',
      '1 payment into your account wasn’t recognised, so it’s counted as income. If it was a transfer or a loan, change its category in the table below.',
    ])
  })

  it('counts unrecognised payments in the plural', () => {
    renderReasons(specExample({ savingsRate: 0.2, unrecognisedIncomeCount: 3 }))

    expect(
      screen.getByText(/^3 payments into your account weren’t recognised, so they’re counted as income\./),
    ).toBeInTheDocument()
  })

  it('ends with keep_going after a single tip, which reads well on its own line', () => {
    // Only the emergency-savings tip applies.
    renderReasons(
      specExample({ savingsRate: 0.2, categoryMonthlyAvg: { fees: 100 }, wantsShare: 0.25, spendingCV: 0.05 }),
    )

    const more = within(screen.getByRole('list', { name: 'Also worth doing' }))
    expect(more.getByRole('listitem')).toHaveTextContent(
      'Keep up the habits that already score well: they’re what holds your score up.',
    )
  })

  it('says "What would help" over the tips when no reason has a tip of its own', () => {
    renderReasons(specExample({ savingsRate: 0.2, bufferMonths: 3.4, categoryMonthlyAvg: {}, wantsShare: 0.25 }))

    expect(screen.getByRole('list', { name: 'What would help' })).toHaveTextContent(
      'Keep up the habits that already score well',
    )
  })
})

describe('ReasonsAndTips: edges', () => {
  it('uses the weights the ledger uses when a measure is not scored (R12)', () => {
    // No savings entered: the savings rate's 25% becomes a third of the total.
    renderReasons(specExample({ bufferMonths: null }), { ...withSavings, emergencySavings: null })

    expect(reasons().map((item) => within(item).getByText(/^Worth up to/).textContent)).toEqual([
      'Worth up to 14 more points',
      'Worth up to 8.8 more points',
      'Worth up to 2.8 more points',
    ])
  })

  it('names the strongest measures when every one scores 80 or more', () => {
    renderReasons(
      specExample({ savingsRate: 0.25, bufferMonths: 6.5, wantsShare: 0.18, spendingCV: 0.15 }),
    )

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Why 98: what you do well')
    expect(screen.queryByText(/^Worth up to/)).not.toBeInTheDocument()
    expect(reasons()[0]).toHaveTextContent('Scores 100 out of 100')
    expect(screen.getByText(/^Every measure that could be scored is at 80 or more/))
      .toBeInTheDocument()
  })

  it('never says a tiny amount of emergency savings covers 0.0 months (R49)', () => {
    renderReasons(specExample({ bufferMonths: 0.03 }), {
      ...withSavings,
      emergencySavings: { amount: 400, currency: 'BDT' },
    })

    expect(reasons()[0]).toHaveTextContent(
      'Your ৳400 in savings would cover less than 0.1 months of essentials.',
    )
  })

  it('says how much more was paid out than earned', () => {
    renderReasons(specExample({ savingsRate: -0.08, spending: 74_520 }))

    expect(screen.getByText(/^You paid out/)).toHaveTextContent(
      'You paid out ৳1,840 a month more than you earned, 8% of your income.',
    )
  })

  it('states the debt payments it is worth reducing', () => {
    renderReasons(specExample({ debtRatio: 0.3, debtPayments: 20_700 }))

    expect(screen.getByText(/of your income went on debt payments/)).toHaveTextContent(
      '30% of your income went on debt payments, about ৳6,900 a month. Keeping them to 10% or less scores 90 or more, and none at all scores 100.',
    )
  })

  it('shows nothing unless there is a score (R14)', () => {
    const { container } = renderReasons(specExample({ income: 0, savingsRate: null, debtRatio: null }))

    expect(container).toBeEmptyDOMElement()
  })
})
