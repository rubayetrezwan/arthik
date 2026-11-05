import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesFor } from '../domain/categories'
import { convert } from '../domain/currency'
import { tx } from '../domain/fixtures'
import type { Transaction } from '../domain/types'
import { formatMoney } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import { PrefsProvider } from '../state/prefs'
import { TransactionsTable } from './TransactionsTable'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

const MINUS = '−'

function renderTable(transactions: Transaction[]) {
  const onCategoryChange = vi.fn()
  render(
    <PrefsProvider>
      <I18nProvider>
        <TransactionsTable transactions={transactions} onCategoryChange={onCategoryChange} />
      </I18nProvider>
    </PrefsProvider>,
  )
  return { onCategoryChange, table: screen.getByRole('table', { name: 'Your transactions' }) }
}

/** The row of column headings. */
function headerRow(table: HTMLElement): HTMLElement {
  return within(table).getAllByRole('row')[0]!
}

/** The body rows of the table, top to bottom. */
function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole('row').slice(1)
}

/** One transaction a day from 1 August 2026, in file order. */
function daily(count: number): Transaction[] {
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10)
    return tx(day, 'groceries', -(100 + index), { description: `Shop ${index + 1}` })
  })
}

describe('TransactionsTable', () => {
  it('is a real table with a heading for every column', () => {
    const { table } = renderTable(daily(3))

    const headings = within(headerRow(table)).getAllByRole('columnheader')
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Date',
      'Description',
      'Category',
      'Amount',
    ])
  })

  it('says a category was matched from the description or taken from the file', () => {
    renderTable(daily(1))

    expect(
      screen.getByText(/matched from each description, or taken from a category column in your file/),
    ).toBeInTheDocument()
  })

  it('lists the newest first, 20 at a time, with "Show more" for the rest', async () => {
    const user = userEvent.setup()
    const { table } = renderTable(daily(45))

    let rows = bodyRows(table)
    expect(rows).toHaveLength(20)
    expect(rows[0]).toHaveTextContent('Shop 45')
    expect(rows[19]).toHaveTextContent('Shop 26')
    expect(screen.getByText('Showing 20 of 45 transactions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    rows = bodyRows(table)
    expect(rows).toHaveLength(40)
    expect(rows[20]).toHaveTextContent('Shop 25')
    // The first row shown is where the reader carries on.
    expect(within(rows[20]!).getByRole('combobox')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(bodyRows(table)).toHaveLength(45)
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    expect(screen.getByText('Showing 45 of 45 transactions')).toBeInTheDocument()
  })

  it('keeps the order of the file for transactions on the same day, latest line first', () => {
    const { table } = renderTable([
      tx('2026-10-31', 'eating_out', -640, { description: 'First line' }),
      tx('2026-10-31', 'fees', -74, { description: 'Second line' }),
      tx('2026-10-30', 'transport', -185, { description: 'Day before' }),
    ])

    expect(bodyRows(table).map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual(
      ['Second line', 'First line', 'Day before'],
    )
  })

  it('shows the date, the description and the amount with its sign', () => {
    const { table } = renderTable([
      tx('2026-10-28', 'side_income', 4_000, { description: 'Tutoring fee via Nagad' }),
      tx('2026-10-31', 'eating_out', -640, { description: 'Foodpanda order, Kacchi Bhai' }),
    ])

    const [out, incoming] = bodyRows(table).map((row) => within(row).getAllByRole('cell'))
    expect(out?.map((cell) => cell.textContent)).toEqual([
      '31 Oct',
      'Foodpanda order, Kacchi Bhai',
      expect.stringContaining('Eating out & delivery'),
      `${MINUS}৳640`,
    ])
    expect(incoming?.[3]).toHaveTextContent('+৳4,000')
    // A sign stays with its amount in right-to-left text.
    expect(incoming?.[3]?.querySelector('bdi')).toHaveTextContent('+৳4,000')
  })

  it('shows amounts in the display currency, with the original beside one that differs', () => {
    localStorage.setItem('arthik.currency', 'USD')
    const { table } = renderTable([
      tx('2026-10-31', 'groceries', -1_240, { description: 'Chaldal groceries' }),
      tx('2026-10-30', 'groceries', -12.5, { description: 'Tesco', currency: 'GBP' }),
    ])

    const [bdt, gbp] = bodyRows(table).map((row) => within(row).getAllByRole('cell')[3])
    const usd = (amount: number, from: 'BDT' | 'GBP') =>
      formatMoney(convert(amount, from, 'USD'), 'USD', 'en', { signed: true })
    expect(bdt).toHaveTextContent(usd(-1_240, 'BDT'))
    expect(bdt).toHaveTextContent(`Originally ${MINUS}৳1,240`)
    expect(gbp).toHaveTextContent(usd(-12.5, 'GBP'))
    expect(gbp).toHaveTextContent(`Originally ${MINUS}£12.50`)
  })

  it('does not repeat an amount already in the display currency', () => {
    const { table } = renderTable([tx('2026-10-31', 'groceries', -1_240)])

    expect(bodyRows(table)[0]).not.toHaveTextContent('Originally')
  })

  it('offers each transaction the categories that fit its direction', () => {
    const { table } = renderTable([
      tx('2026-10-28', 'side_income', 4_000, { description: 'Tutoring fee' }),
      tx('2026-10-27', 'groceries', -1_240, { description: 'Chaldal groceries' }),
    ])

    const values = (name: string) =>
      within(within(table).getByRole('combobox', { name }))
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value)
    expect(values('Category for Tutoring fee')).toEqual(categoriesFor('in'))
    expect(values('Category for Chaldal groceries')).toEqual(categoriesFor('out'))
  })

  it('reports a changed category with the transaction’s id and the new category', async () => {
    const user = userEvent.setup()
    const shop = tx('2026-10-31', 'eating_out', -640, { description: 'Foodpanda order' })
    const { onCategoryChange } = renderTable([shop])

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Category for Foodpanda order' }),
      'Groceries',
    )

    expect(onCategoryChange).toHaveBeenCalledExactlyOnceWith(shop.id, 'groceries')
  })

  it('flags money in that was not recognised, and ties the flag to its select', () => {
    renderTable([
      tx('2026-10-16', 'other_income', 3_000, {
        description: 'Received from 01712xxxxxx',
        unrecognisedIncome: true,
      }),
      tx('2026-10-15', 'other_income', 500, { description: 'Interest' }),
    ])

    const flags = screen.getAllByText('Not recognised: counted as income. Check it.')
    expect(flags).toHaveLength(1)
    expect(
      screen.getByRole('combobox', { name: 'Category for Received from 01712xxxxxx' }),
    ).toHaveAccessibleDescription('Not recognised: counted as income. Check it.')
    expect(screen.getByRole('combobox', { name: 'Category for Interest' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })
})
