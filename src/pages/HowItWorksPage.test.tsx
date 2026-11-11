import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ANCHORS } from '../domain/anchors'
import { CATEGORIES } from '../domain/categories'
import { RATES } from '../domain/currency'
import { MIN_MONTHS_FOR_CV } from '../domain/measures'
import { completeMonths, EDGE_DAYS, MAX_MONTHS } from '../domain/period'
import {
  BAND_RANGES,
  computeScore,
  MEASURE_IDS,
  MIN_SCORED_MEASURES,
  WEIGHTS,
  type MeasureId,
} from '../domain/score'
import {
  formatFullDate,
  formatMonthRange,
  formatNumber,
  formatPercent,
  formatPoints,
  formatWeight,
} from '../i18n/format'
import en from '../i18n/messages/en.json'
import { EXAMPLE_MEASURES } from '../components/howItWorks/workedExample'
import { EXISTING } from '../test/messageFiles'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

const messages: Record<string, string> = en
const html = document.documentElement

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

/** The text of each cell in each body row of a table, header cells included. */
function bodyRows(table: HTMLElement): string[][] {
  const body = table.querySelector('tbody')
  if (!body) throw new Error('table has no body')
  return [...body.rows].map((row) => [...row.cells].map((cell) => cell.textContent ?? ''))
}

/** An anchor value as the page should write it: months for emergency savings, else a percentage. */
function anchorValue(id: MeasureId, x: number): string {
  return id === 'emergencySavings'
    ? formatNumber(x, 'en', Number.isInteger(x) ? 0 : 1)
    : formatPercent(x, 'en')
}

describe('HowItWorksPage', () => {
  it('has exactly one h1, and headings that never skip a level', () => {
    renderApp('/how-it-works')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent('How the score works')

    const levels = [...screen.getByRole('main').querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (heading) => Number(heading.tagName.slice(1)),
    )
    expect(levels[0]).toBe(1)
    levels.slice(1).forEach((level, index) => {
      expect(level, `heading ${index + 2}`).toBeLessThanOrEqual((levels[index] ?? 0) + 1)
      expect(level, `heading ${index + 2}`).toBeGreaterThan(1)
    })
  })

  it('covers the method, the bands, the months, the categories, the framework, the limitations and privacy', () => {
    renderApp('/how-it-works')

    const h2s = main()
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(h2s).toEqual([
      'The five measures',
      'How the points add up',
      'The three bands',
      'Which months count',
      'How your transactions are sorted',
      'Where the method comes from',
      'Limitations',
      'Your privacy',
    ])
    // One section per measure, in ledger order.
    for (const id of MEASURE_IDS) {
      expect(main().getByRole('heading', { level: 3, name: messages[`measure.${id}.name`] }))
    }
  })

  describe('the five measures', () => {
    it('shows each weight, and a total of 100%', () => {
      renderApp('/how-it-works')

      const rows = bodyRows(main().getByRole('table', { name: 'The five measures' }))
      expect(rows).toHaveLength(MEASURE_IDS.length)
      MEASURE_IDS.forEach((id, index) => {
        expect(rows[index]?.[0]).toContain(messages[`measure.${id}.name`])
        expect(rows[index]?.[1]).toBe(formatWeight(WEIGHTS[id] * 10, 'en'))
      })

      const total = main().getByRole('table', { name: 'The five measures' }).querySelector('tfoot')
      expect(total).toHaveTextContent('Total')
      expect(total).toHaveTextContent('100%')
      const sum = MEASURE_IDS.reduce((s, id) => s + WEIGHTS[id], 0)
      expect(total).toHaveTextContent(formatWeight(sum * 10, 'en'))
    })

    it('gives the savings-rate anchor points: −10%, 0%, 10% and 20% score 0, 30, 70 and 100', () => {
      renderApp('/how-it-works')

      expect(bodyRows(main().getAllByRole('table')[1]!)).toEqual([
        ['−10% or less', '0'],
        ['0%', '30'],
        ['10%', '70'],
        ['20% or more', '100'],
      ])
    })

    it('draws every anchor table from ANCHORS', () => {
      renderApp('/how-it-works')

      for (const id of MEASURE_IDS) {
        const rows = bodyRows(main().getByRole('table', { name: messages[`measure.${id}.name`] }))
        const anchors = ANCHORS[id]
        expect(rows, id).toHaveLength(anchors.length)
        anchors.forEach(([x, score], index) => {
          expect(rows[index]?.[0], `${id} ${x}`).toContain(anchorValue(id, x))
          expect(rows[index]?.[1], `${id} ${x}`).toBe(formatNumber(score, 'en'))
        })
        // Beyond the last anchor the score stays the same.
        expect(rows.at(-1)?.[0], id).toMatch(/or more$/)
      }
    })

    it('says only the measures that can go below zero have no floor on their first anchor', () => {
      renderApp('/how-it-works')

      const firstValue = (id: MeasureId) =>
        bodyRows(main().getByRole('table', { name: messages[`measure.${id}.name`] }))[0]?.[0]
      expect(firstValue('emergencySavings')).toBe('0')
      expect(firstValue('debtPayments')).toBe('0%')
      expect(firstValue('needsWants')).toBe('20% or less')
      expect(firstValue('stability')).toBe('10% or less')
    })

    it('works a point between two anchors out with the real interpolation', () => {
      renderApp('/how-it-works')

      expect(
        main().getByText(/Between two anchor points, the score moves in a straight line/),
      ).toHaveTextContent('keeping 5% of your income, halfway between 0% and 10%, scores 50.')
    })

    it('gives each measure its formula and when it is not scored', () => {
      renderApp('/how-it-works')

      expect(main().getByText('(Income − spending − debt payments) ÷ income')).toBeInTheDocument()
      expect(
        main().getByText('Emergency savings ÷ average monthly spending on essentials'),
      ).toBeInTheDocument()
      expect(main().getByText('Debt payments ÷ income')).toBeInTheDocument()
      expect(main().getByText('Wants ÷ (essentials + wants)')).toBeInTheDocument()
      expect(
        main().getByText('Standard deviation of monthly spending ÷ average monthly spending'),
      ).toBeInTheDocument()
      expect(
        main().getByText(
          `Not scored with fewer than ${MIN_MONTHS_FOR_CV} complete months of data, or with no spending.`,
        ),
      ).toBeInTheDocument()
    })

    it('describes emergency savings as months of essentials covered (R46)', () => {
      renderApp('/how-it-works')

      const section = screen
        .getByRole('heading', { level: 3, name: 'Emergency savings' })
        .closest('section')
      expect(section).toHaveTextContent(
        'How many months of essential spending your savings would cover',
      )
      expect(section?.textContent).not.toMatch(/income stopped|could live|would last/i)
    })
  })

  describe('how the points add up', () => {
    it('works the spec example through: 14.50 + 11.00 + 20.00 + 8.40 + 12.90 = 66.80, which is 67', () => {
      renderApp('/how-it-works')

      const table = main().getByRole('table', { name: 'An example' })
      const rows = bodyRows(table)
      expect(rows.map((row) => row[1])).toEqual([
        '58 × 25%',
        '44 × 25%',
        '100 × 20%',
        '56 × 15%',
        '86 × 15%',
      ])
      expect(rows.map((row) => row[2])).toEqual(['14.50', '11.00', '20.00', '8.40', '12.90'])
      const foot = table.querySelector('tfoot')
      expect(foot).toHaveTextContent('Total66.80')
      expect(foot).toHaveTextContent('Score, rounded67')
      expect(main().getByText('The total, 66.80, rounds to 67, which is Coping.')).toBeInTheDocument()
    })

    it('takes the example from computeScore, not from typed numbers', () => {
      renderApp('/how-it-works')

      const result = computeScore(EXAMPLE_MEASURES)
      const table = main().getByRole('table', { name: 'An example' })
      expect(bodyRows(table).map((row) => row[2])).toEqual(
        result.lines.map((line) => formatPoints(line.pointsHundredths ?? NaN, 'en')),
      )
      expect(table.querySelector('tfoot')).toHaveTextContent(
        formatPoints(result.totalHundredths ?? NaN, 'en'),
      )
    })

    it('shows how the weights are shared out when emergency savings are not scored', () => {
      renderApp('/how-it-works')

      const rows = bodyRows(main().getByRole('table', { name: 'When a measure can’t be scored' }))
      expect(rows.map((row) => row[1])).toEqual(['33.3%', 'Not scored', '26.7%', '20%', '20%'])

      const result = computeScore({ ...EXAMPLE_MEASURES, bufferMonths: null })
      expect(rows.map((row) => row[1])).toEqual(
        result.lines.map((line) =>
          line.subScore === null ? 'Not scored' : formatWeight(line.weightTenths, 'en'),
        ),
      )
    })

    it('says when there is no score, with the minimum number of measures', () => {
      renderApp('/how-it-works')

      expect(
        main().getByText(
          `Fewer than ${MIN_SCORED_MEASURES} of the ${MEASURE_IDS.length} measures can be scored.`,
        ),
      ).toBeInTheDocument()
    })
  })

  it('lists the bands from BAND_RANGES', () => {
    renderApp('/how-it-works')

    const rows = bodyRows(main().getByRole('table', { name: 'The three bands' }))
    expect(rows).toHaveLength(BAND_RANGES.length)
    BAND_RANGES.forEach(({ band, min, max }, index) => {
      expect(rows[index]?.[0]).toContain(messages[`band.${band}`])
      expect(rows[index]?.[1]).toBe(`${min}–${max}`)
    })
    expect(rows.map((row) => row[1])).toEqual(['0–39', '40–79', '80–100'])
  })

  it('gives the complete-month rule from EDGE_DAYS and MAX_MONTHS, with a worked example', () => {
    renderApp('/how-it-works')

    const section = screen.getByRole('heading', { level: 2, name: 'Which months count' }).closest('section')
    expect(section).toHaveTextContent(`the most recent complete ones in your data, up to ${MAX_MONTHS}.`)
    expect(section).toHaveTextContent(`start by day ${EDGE_DAYS} of it`)
    expect(section).toHaveTextContent(`reach its final ${EDGE_DAYS} days`)

    const months = completeMonths(['2026-05-12', '2026-10-27'])
    expect(section).toHaveTextContent(
      `For example, transactions from ${formatFullDate('2026-05-12', 'en')} to ${formatFullDate('2026-10-27', 'en')} use ${formatMonthRange(months[0] ?? '', months.at(-1) ?? '', 'en')}.`.replace(/\s+/g, ' '),
    )
    expect(section).toHaveTextContent('May 2026 is left out because your transactions start after day 7 of it.')
  })

  it('puts each sentence of the worked example in its own paragraph', () => {
    renderApp('/how-it-works')

    const left = screen.getByText('May 2026 is left out because your transactions start after day 7 of it.')
    expect(left.tagName).toBe('P')
    const example = screen.getByText(/^For example, transactions from /)
    expect(example.tagName).toBe('P')
    expect(example).not.toBe(left)
    expect(example).not.toHaveTextContent('left out')
  })

  it('says a category comes from the description or from a category column in the file', () => {
    renderApp('/how-it-works')

    expect(
      screen.getByText(/^Each transaction gets a category, matched from its description, or taken from a category column in your file./),
    ).toBeInTheDocument()
  })

  it('sorts every category into its group, in the order of CATEGORIES', () => {
    renderApp('/how-it-works')

    const groups = [...new Set(CATEGORIES.map((category) => category.group))]
    const rows = bodyRows(main().getByRole('table', { name: 'How your transactions are sorted' }))
    expect(rows).toHaveLength(groups.length)
    groups.forEach((group, index) => {
      expect(rows[index]?.[0]).toContain(messages[`group.${group}`])
      expect(rows[index]?.[1]).toBe(messages[`howItWorks.group.${group}.treatment`])
      for (const category of CATEGORIES.filter((c) => c.group === group)) {
        expect(rows[index]?.[0], category.id).toContain(messages[`category.${category.id}`])
      }
    })
  })

  it('explains the cash, refund, unrecognised income, credit card and family rules', () => {
    renderApp('/how-it-works')

    for (const title of [
      'Cash withdrawals',
      'Refunds',
      'Money in that isn’t recognised',
      'Several accounts in one file',
      'Credit card bills',
      'Money sent to family',
      'Other currencies',
    ]) {
      expect(main().getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
    expect(main().getByText(/counts as a debt payment, even when you pay it in full/)).toHaveTextContent(
      'change the bill payment to Own-account transfer',
    )
    expect(main().getByText(/is counted as Other income/)).toBeInTheDocument()
    expect(main().getByText(/Family support sent counts as an essential, not a want/)).toBeInTheDocument()
  })

  it('names the bundled exchange rates by source and date', () => {
    renderApp('/how-it-works')

    expect(main().getByText(/Amounts in other currencies are converted to taka/)).toHaveTextContent(
      `at exchange rates from ${RATES.source} as of ${formatFullDate(RATES.date, 'en')}.`,
    )
  })

  it('cites the FinHealth Score and says plainly that Plan is not measured', () => {
    renderApp('/how-it-works')

    const section = screen
      .getByRole('heading', { level: 2, name: 'Where the method comes from' })
      .closest('section')
    expect(section).toHaveTextContent('inspired by the Financial Health Network’s FinHealth Score')
    expect(section).toHaveTextContent('Spend, Save, Borrow and Plan')
    expect(section).toHaveTextContent('Planning can’t be seen in transactions, so Arthik doesn’t measure it.')
    expect(section).toHaveTextContent(
      'Reference: Financial Health Network, FinHealth Score Toolkit (2021), and “Eight Ways to Measure Financial Health”.',
    )
    // A citation, not a fetched resource.
    expect(section?.querySelector('a, img, iframe')).toBeNull()
  })

  it('lists the limitations from spec 5.4', () => {
    renderApp('/how-it-works')

    const list = within(
      screen.getByRole('heading', { level: 2, name: 'Limitations' }).closest('section') as HTMLElement,
    ).getByRole('list')
    expect(list).toHaveTextContent('Planning isn’t measured.')
    expect(list).toHaveTextContent('Credit card payments count as debt payments, even when you pay the bill in full.')
    expect(list).toHaveTextContent('The anchor points are reasoned benchmarks.')
    expect(list).toHaveTextContent('Spending stability looks at your spending, not at how steady your income is.')
  })

  it('says what is and is not kept', () => {
    renderApp('/how-it-works')

    const section = screen.getByRole('heading', { level: 2, name: 'Your privacy' }).closest('section')
    expect(section).toHaveTextContent('It’s never uploaded.')
    expect(section).toHaveTextContent('Nothing about your money is saved')
    expect(section).toHaveTextContent('the language, the currency and the colour theme you chose')
  })

  it('never shows a raw key or a broken number', () => {
    renderApp('/how-it-works')

    const text = screen.getByRole('main').textContent ?? ''
    expect(text).not.toMatch(/howItWorks\.|NaN|undefined|null|Infinity/)
  })

  it('formats every figure in the language on screen', async () => {
    localStorage.setItem('arthik.locale', 'bn')
    renderApp('/how-it-works')
    await waitFor(() => expect(html.lang).toBe('bn-BD'))

    expect(bodyRows(main().getAllByRole('table')[1]!).map((row) => row[1])).toEqual([
      '০',
      '৩০',
      '৭০',
      '১০০',
    ])
  })
})

describe('the How the score works copy', () => {
  it.each(EXISTING)(
    'never types a digit in %s: every number comes from a placeholder or a table',
    (_code, texts) => {
      const typed = Object.entries(texts).filter(
        ([key, text]) => key.startsWith('howItWorks.') && /\p{Nd}/u.test(text),
      )
      expect(typed).toEqual([])
    },
  )
})

describe('HowItWorksPage: contents', () => {
  function contents() {
    return within(screen.getByRole('navigation', { name: 'On this page' }))
  }

  it('lists every section, in order, by its heading', () => {
    renderApp('/how-it-works')

    const headings = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(contents().getAllByRole('link').map((link) => link.textContent)).toEqual(headings)
  })

  it('moves to the section and focuses its heading, keeping the page in the router', async () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    renderApp('/how-it-works')
    const user = userEvent.setup()

    await user.click(contents().getByRole('link', { name: 'Your privacy' }))

    const heading = screen.getByRole('heading', { level: 2, name: 'Your privacy' })
    await waitFor(() => expect(heading).toHaveFocus())
    expect(scroll).toHaveBeenCalled()
    expect(window.location.hash).toBe('#/how-it-works#privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('How the score works')
  })
})
