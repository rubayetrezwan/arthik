import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLES } from '../data/samples'
import { convert } from '../domain/currency'
import { computeMeasures, type Measures } from '../domain/measures'
import { formatMoney } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import { PrefsProvider } from '../state/prefs'
import { MonthlyChart } from './MonthlyChart'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.spyOn(console, 'error')
})

const nusrat = computeMeasures(SAMPLES.nusrat)

function renderChart(measures: Measures = nusrat) {
  return render(
    <PrefsProvider>
      <I18nProvider>
        <MonthlyChart measures={measures} />
      </I18nProvider>
    </PrefsProvider>,
  )
}

const taka = (amount: number) => formatMoney(amount, 'BDT', 'en')

describe('MonthlyChart', () => {
  it('reveals a table with a row for each of the 6 months on "Show as table"', async () => {
    const user = userEvent.setup()
    renderChart()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show as table' }))

    const table = screen.getByRole('table', { name: 'Money in and out, by month' })
    const [header, ...rows] = within(table).getAllByRole('row')
    expect(within(header!).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Month',
      'Income',
      'Spending',
    ])
    expect(rows).toHaveLength(6)
    const [may] = rows
    expect(within(may!).getByRole('rowheader')).toHaveTextContent('May 2026')
    expect(within(may!).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      taka(nusrat.monthly[0]!.income),
      taka(nusrat.monthly[0]!.spending),
    ])
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('goes back to the chart on "Show as chart"', async () => {
    const user = userEvent.setup()
    renderChart()

    await user.click(screen.getByRole('button', { name: 'Show as table' }))
    await user.click(screen.getByRole('button', { name: 'Show as chart' }))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('sums up the ranges in words for screen readers', () => {
    renderChart()

    const spending = nusrat.monthly.map((month) => month.spending)
    const label = screen.getByRole('img').getAttribute('aria-label')
    expect(label).toMatch(/^Income and spending by month, May.+Oct 2026\. /)
    expect(label).toContain('Income was ৳23,000 every month.')
    expect(label).toContain(
      `Spending ranged from ${taka(Math.min(...spending))} to ${taka(Math.max(...spending))} a month.`,
    )
    // May and September spent more than came in.
    expect(label).toContain('Spending went above income in May 2026 and Sep 2026.')
  })

  it('says when spending never went above income', () => {
    renderChart(computeMeasures(SAMPLES.rahim))

    expect(screen.getByRole('img').getAttribute('aria-label')).toContain(
      'Spending never went above income.',
    )
  })

  it('labels the y-axis in round amounts of the display currency', () => {
    renderChart()

    // Spending peaks just under 24,000, so the axis runs to 30,000 in thirds.
    expect(screen.getAllByTestId('y-label').map((label) => label.textContent)).toEqual([
      '৳30,000',
      '৳20,000',
      '৳10,000',
      '৳0',
    ])
  })

  it('converts the axis to the display currency', () => {
    localStorage.setItem('arthik.currency', 'USD')
    renderChart()

    const labels = screen.getAllByTestId('y-label').map((label) => label.textContent ?? '')
    expect(labels.at(-1)).toBe('$0.00')
    for (const label of labels) expect(label).toMatch(/^\$[\d,]+\.\d\d$/)
    const top = Number(labels[0]!.replace(/[$,]/g, ''))
    const peak = Math.max(...nusrat.monthly.map((month) => convert(month.spending, 'BDT', 'USD')))
    expect(top).toBeGreaterThanOrEqual(peak)
    expect(top / 3).toBeLessThan(peak)
  })

  it('draws each month’s bars to scale, income outlined and spending filled', () => {
    renderChart()

    const [income, spending] = screen.getAllByTestId('bar').slice(0, 2)
    expect(income).toHaveAttribute('data-kind', 'income')
    expect(parseFloat(income!.style.blockSize)).toBeCloseTo((23_000 / 30_000) * 100, 5)
    expect(spending).toHaveAttribute('data-kind', 'spending')
    expect(parseFloat(spending!.style.blockSize)).toBeCloseTo(
      (nusrat.monthly[0]!.spending / 30_000) * 100,
      5,
    )
  })

  it('names the months under the bars', () => {
    renderChart()

    expect(screen.getAllByTestId('x-label').map((label) => label.textContent)).toEqual([
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
    ])
  })

  it('shows nothing when there is no complete month, or no money in or out', () => {
    const { container, unmount } = renderChart({ ...nusrat, months: [], monthly: [] })
    expect(container).toBeEmptyDOMElement()
    unmount()

    const still = nusrat.monthly.map((month) => ({ ...month, income: 0, spending: 0 }))
    const { container: quiet } = renderChart({ ...nusrat, monthly: still })
    expect(quiet).toBeEmptyDOMElement()
    expect(console.error).not.toHaveBeenCalled()
  })
})
