import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Measures } from '../domain/measures'
import { computeScore, type ScoreResult } from '../domain/score'
import { I18nProvider } from '../i18n/I18nProvider'
import { PrefsProvider } from '../state/prefs'
import { Ledger } from './Ledger'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

/** The spec's worked example (spec 5.4): sub-scores 58, 44, 100, 56 and 86. */
function specExample(overrides: Partial<Measures> = {}): Measures {
  return {
    months: ['2026-08', '2026-09', '2026-10'],
    monthly: [],
    income: 150_000,
    spending: 90_000,
    essentials: 60_000,
    wants: 30_000,
    debtPayments: 0,
    categoryMonthlyAvg: {},
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

function renderLedger(result: ScoreResult, uncategorisedShare = 0) {
  return render(
    <PrefsProvider>
      <I18nProvider>
        <Ledger result={result} uncategorisedShare={uncategorisedShare} />
      </I18nProvider>
    </PrefsProvider>,
  )
}

function table() {
  return within(screen.getByRole('table'))
}

/** The five measure rows, in ledger order. */
function measureRows() {
  return table().getAllByRole('row').slice(1, 6)
}

/** The text of one column of the measure rows: 0 is the score, 1 the weight, 2 the points. */
function column(index: number): string[] {
  return measureRows().map((row) => within(row).getAllByRole('cell')[index]?.textContent ?? '')
}

describe('Ledger: the spec example', () => {
  const result = computeScore(specExample())

  it('is titled with the score it adds up to', () => {
    renderLedger(result)

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('How 67 adds up')
  })

  it('lists the five measures by name, each with its own number in plain words', () => {
    renderLedger(result)

    const headers = measureRows().map((row) => within(row).getByRole('rowheader'))
    expect(headers.map((header) => header.textContent)).toEqual([
      'Savings rateYou kept 7% of your income',
      'Emergency savingsWould cover 1.2 months of essentials',
      'Debt paymentsNo loan or card payments',
      'Needs vs. wants38% of your spending went on wants',
      'Spending stabilityYour monthly spending varies by about 15%',
    ])
  })

  it('shows each score out of 100 with its band', () => {
    renderLedger(result)

    expect(column(0)).toEqual([
      '58 / 100Coping',
      '44 / 100Coping',
      '100 / 100Healthy',
      '56 / 100Coping',
      '86 / 100Healthy',
    ])
  })

  it('shows how much each measure counts for', () => {
    renderLedger(result)

    expect(column(1)).toEqual(['25%', '25%', '20%', '15%', '15%'])
  })

  it('shows the points 14.50, 11.00, 20.00, 8.40 and 12.90', () => {
    renderLedger(result)

    expect(column(2)).toEqual(['14.50', '11.00', '20.00', '8.40', '12.90'])
  })

  it('totals the points to 66.80 and rounds the total to a score of 67', () => {
    renderLedger(result)

    const [total, rounded] = table().getAllByRole('row').slice(6)
    expect(within(total!).getByRole('rowheader')).toHaveTextContent('Total')
    expect(within(total!).getByRole('cell')).toHaveTextContent('66.80')
    expect(within(rounded!).getByRole('rowheader')).toHaveTextContent('Score, rounded')
    expect(within(rounded!).getByRole('cell')).toHaveTextContent('67')
  })

  it('totals the points only, never the weights', () => {
    renderLedger(result)

    const footer = screen.getByRole('table').querySelector('tfoot')
    expect(footer).not.toBeNull()
    expect(footer?.textContent).not.toContain('%')
  })

  it('is a real table with a heading for every column', () => {
    renderLedger(result)

    const [headerRow] = table().getAllByRole('row')
    const headings = within(headerRow!).getAllByRole('columnheader')
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Measure',
      'Score',
      'Counts for',
      'Points',
    ])
    for (const heading of headings) expect(heading).toHaveAttribute('scope', 'col')
  })
})

describe('Ledger: a measure that cannot be scored', () => {
  // The same person with no emergency savings entered: its weight is shared out.
  const result = computeScore(specExample({ bufferMonths: null }))

  it('shows the effective weights of the measures that are scored', () => {
    renderLedger(result)

    expect(column(1)).toEqual(['33.3%', '—', '26.7%', '20%', '20%'])
  })

  it('says "Not scored" and why, in place of a score', () => {
    renderLedger(result)

    const [, emergency] = measureRows()
    const [score] = within(emergency!).getAllByRole('cell')
    expect(score).toHaveTextContent('Not scored')
    expect(score).toHaveTextContent('You didn’t enter your emergency savings.')
  })

  it('still adds up exactly, to 74.40 and a score of 74', () => {
    renderLedger(result)

    expect(column(2)).toEqual(['19.33', '—', '26.67', '11.20', '17.20'])
    const [total, rounded] = table().getAllByRole('row').slice(6)
    expect(within(total!).getByRole('cell')).toHaveTextContent('74.40')
    expect(within(rounded!).getByRole('cell')).toHaveTextContent('74')
  })

  it('explains that the weight of a measure left out is shared among the others', () => {
    renderLedger(result)

    expect(
      screen.getByText(
        'A measure that can’t be scored is left out, and its weight is shared among the others in proportion.',
      ),
    ).toBeInTheDocument()
  })

  it('does not explain re-weighting when all five are scored', () => {
    renderLedger(computeScore(specExample()))

    expect(screen.queryByText(/its weight is shared among the others/)).not.toBeInTheDocument()
  })
})

describe('Ledger: plain-language values at the edges', () => {
  it('says how much more you paid out than you earned when the savings rate is negative', () => {
    renderLedger(computeScore(specExample({ savingsRate: -0.076 })))

    expect(measureRows()[0]).toHaveTextContent('You paid out 8% more than you earned')
  })

  it('says you spent about what you earned when the savings rate rounds to zero', () => {
    renderLedger(computeScore(specExample({ savingsRate: -0.002 })))

    expect(measureRows()[0]).toHaveTextContent('You spent about as much as you earned')
  })

  it('names debt payments as a share of income when there are some', () => {
    renderLedger(computeScore(specExample({ debtRatio: 0.376 })))

    expect(measureRows()[2]).toHaveTextContent('38% of your income went on debt payments')
  })

  it('says there are no emergency savings when they are zero', () => {
    renderLedger(computeScore(specExample({ bufferMonths: 0 })))

    expect(measureRows()[1]).toHaveTextContent('No emergency savings')
  })
})

describe('Ledger: a tiny amount never reads as zero (R49)', () => {
  it('says "under 1%" for debt payments that round to 0%', () => {
    renderLedger(computeScore(specExample({ debtRatio: 0.003 })))

    expect(measureRows()[2]).toHaveTextContent('Under 1% of your income went on debt payments')
  })

  it('says "less than 0.1 months" for emergency savings that round to 0.0', () => {
    renderLedger(computeScore(specExample({ bufferMonths: 0.03 })))

    expect(measureRows()[1]).toHaveTextContent('Would cover less than 0.1 months of essentials')
  })

  it('shows 0.1 months as it is, once it rounds up to that', () => {
    renderLedger(computeScore(specExample({ bufferMonths: 0.05 })))

    expect(measureRows()[1]).toHaveTextContent('Would cover 0.1 months of essentials')
  })

  it('says "under 1%" for wants and for swings in spending that round to 0%', () => {
    renderLedger(computeScore(specExample({ wantsShare: 0.002, spendingCV: 0.004 })))

    expect(measureRows()[3]).toHaveTextContent('Under 1% of your spending went on wants')
    expect(measureRows()[4]).toHaveTextContent('Your monthly spending varies by under 1%')
  })

  it('keeps the plain wording for a true zero', () => {
    renderLedger(computeScore(specExample({ debtRatio: 0, wantsShare: 0, spendingCV: 0 })))

    expect(measureRows()[2]).toHaveTextContent('No loan or card payments')
    expect(measureRows()[3]).toHaveTextContent('0% of your spending went on wants')
    expect(measureRows()[4]).toHaveTextContent('Your monthly spending varies by about 0%')
  })
})

describe('Ledger: spending with no category (R4)', () => {
  const result = computeScore(specExample())

  it('says what share of spending has no category yet', () => {
    renderLedger(result, 0.123)

    expect(
      screen.getByText(
        '12% of your spending has no category yet. Sorting it would make your score more accurate.',
      ),
    ).toBeInTheDocument()
  })

  it('says "under 1%" rather than "0%" for a sliver', () => {
    renderLedger(result, 0.003)

    expect(
      screen.getByText(
        'Under 1% of your spending has no category yet. Sorting it would make your score more accurate.',
      ),
    ).toBeInTheDocument()
  })

  it('says nothing when every payment has a category', () => {
    renderLedger(result, 0)

    expect(screen.queryByText(/has no category yet/)).not.toBeInTheDocument()
  })
})

describe('Ledger: in another language', () => {
  it('formats the figures for the language on screen', async () => {
    localStorage.setItem('arthik.locale', 'bn')
    renderLedger(computeScore(specExample()))

    // Bengali has no messages until it is translated, but its digits show at once.
    expect(await screen.findByText('১৪.৫০')).toBeInTheDocument()
    expect(screen.getByText('৬৬.৮০')).toBeInTheDocument()
  })
})
