import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSON_IDS } from '../data/samples'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

function main() {
  return within(screen.getByRole('main'))
}

describe('HomePage', () => {
  it('says what Arthik is in one sentence', () => {
    renderApp('/')

    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent(
      'See how your money habits add up',
    )
    expect(
      main().getByText(
        'Arthik reads your bank or mobile-wallet transactions and gives you a financial health score from 0 to 100, with every point explained.',
      ),
    ).toBeInTheDocument()
  })

  it('offers the five sample people, each linking to their score', () => {
    renderApp('/')

    const samples = within(main().getByRole('region', { name: 'Try a sample person' }))
    const links = samples.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(
      PERSON_IDS.map((id) => `#/score/${id}`),
    )
    expect(links[0]).toHaveAttribute('href', '#/score/nusrat')
    expect(links[0]).toHaveTextContent('Nusrat, university student in Dhaka')
  })

  it('offers the visitor their own transactions, with the privacy promise beside it', () => {
    renderApp('/')

    const own = within(main().getByRole('region', { name: 'Your own transactions' }))
    expect(own.getByRole('link', { name: 'Use your own transactions' })).toHaveAttribute(
      'href',
      '#/upload',
    )
    expect(own.getByText(/Your data stays in your browser/)).toBeInTheDocument()
  })

  it('shows what goes into the score, with weights that add up to the whole', () => {
    renderApp('/')

    const table = main().getByRole('table')
    const rows = within(table).getAllByRole('row')
    // A heading row, the five measures and the total.
    expect(rows).toHaveLength(7)
    expect(rows[1]).toHaveTextContent('Savings rate')
    expect(rows[1]).toHaveTextContent('25%')
    expect(rows[5]).toHaveTextContent('Spending stability')
    expect(rows[5]).toHaveTextContent('15%')
    expect(rows[6]).toHaveTextContent('Total')
    expect(rows[6]).toHaveTextContent('100%')
  })

  it('links to how the score works', () => {
    renderApp('/')

    expect(main().getByRole('link', { name: 'How the score works' })).toHaveAttribute(
      'href',
      '#/how-it-works',
    )
  })
})
