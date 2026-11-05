import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLES } from '../data/samples'
import { convert } from '../domain/currency'
import { computeMeasures, type Measures } from '../domain/measures'
import { formatMoney } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import { PrefsProvider } from '../state/prefs'
import { CategoryChart } from './CategoryChart'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.spyOn(console, 'error')
})

const nusrat = computeMeasures(SAMPLES.nusrat)

function withCategories(categoryMonthlyAvg: Measures['categoryMonthlyAvg']): Measures {
  return { ...nusrat, categoryMonthlyAvg }
}

function renderChart(measures: Measures = nusrat) {
  return render(
    <PrefsProvider>
      <I18nProvider>
        <CategoryChart measures={measures} />
      </I18nProvider>
    </PrefsProvider>,
  )
}

function items() {
  return within(screen.getByRole('list', { name: 'Where the money goes' })).getAllByRole(
    'listitem',
  )
}

describe('CategoryChart', () => {
  it('lists the spending categories by their monthly average, biggest first', () => {
    renderChart(withCategories({ groceries: 3_200, rent: 5_500, eating_out: 3_850, fees: 260 }))

    expect(items().map((item) => item.textContent)).toEqual([
      'Rent & housing৳5,500',
      'Eating out & delivery (want)৳3,850',
      'Groceries৳3,200',
      'Fees & charges৳260',
    ])
  })

  it('stripes the wants, and says "(want)" to screen readers', () => {
    renderChart(withCategories({ rent: 5_500, eating_out: 3_850 }))

    const [rent, eatingOut] = items()
    expect(within(eatingOut!).getByText('(want)')).toHaveClass('visually-hidden')
    expect(eatingOut!.querySelector('[data-kind]')).toHaveAttribute('data-kind', 'want')
    expect(rent!.querySelector('[data-kind]')).toHaveAttribute('data-kind', 'need')
  })

  it('marks spending that is neither a need nor a want', () => {
    renderChart(withCategories({ rent: 5_500, cash_withdrawal: 3_500, gifts: 200 }))

    const [, cash, gifts] = items()
    expect(cash).toHaveTextContent('Cash withdrawal (neither need nor want)')
    expect(cash!.querySelector('[data-kind]')).toHaveAttribute('data-kind', 'other')
    expect(gifts!.querySelector('[data-kind]')).toHaveAttribute('data-kind', 'other')
  })

  it('has a legend for the kinds shown, and says the amounts are monthly averages', () => {
    renderChart(withCategories({ rent: 5_500, eating_out: 3_850 }))

    expect(screen.getByText('Need')).toBeInTheDocument()
    expect(screen.getByText('Want')).toBeInTheDocument()
    expect(screen.queryByText('Neither need nor want')).not.toBeInTheDocument()
    expect(screen.getByText('Average per month')).toBeInTheDocument()
  })

  it('draws each bar against the biggest category', () => {
    renderChart(withCategories({ rent: 5_500, eating_out: 3_850, fees: 260 }))

    const widths = items().map((item) =>
      parseFloat((item.querySelector('[data-kind]') as HTMLElement).style.inlineSize),
    )
    expect(widths[0]).toBe(100)
    expect(widths[1]).toBeCloseTo(70, 5)
    expect(widths[2]).toBeCloseTo((260 / 5_500) * 100, 5)
  })

  it('shows the averages in the display currency', () => {
    localStorage.setItem('arthik.currency', 'GBP')
    renderChart(withCategories({ rent: 5_500 }))

    expect(items()[0]).toHaveTextContent(formatMoney(convert(5_500, 'BDT', 'GBP'), 'GBP', 'en'))
  })

  it('never shows a small average as nothing (R49)', () => {
    renderChart(withCategories({ rent: 5_500, fees: 0.3 }))

    expect(items()[1]).toHaveTextContent('Fees & charges৳0.3')
  })

  it('shows every category of a sample person, and nothing without spending', () => {
    renderChart()
    expect(items()).toHaveLength(Object.keys(nusrat.categoryMonthlyAvg).length)

    const { container } = render(
      <PrefsProvider>
        <I18nProvider>
          <CategoryChart measures={withCategories({})} />
        </I18nProvider>
      </PrefsProvider>,
    )
    expect(container).toBeEmptyDOMElement()
    expect(console.error).not.toHaveBeenCalled()
  })
})
