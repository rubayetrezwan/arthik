import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSON_IDS } from './data/samples'
import { RATES } from './domain/currency'
import { renderApp } from './test/renderApp'

vi.mock('./i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

describe('App', () => {
  it('shows the Arthik name', () => {
    renderApp('/')

    expect(screen.getByText('Arthik')).toBeInTheDocument()
  })

  it.each(['/', '/score/nusrat', '/upload', '/how-it-works', '/about', '/nowhere'])(
    'gives %s exactly one main heading',
    (path) => {
      renderApp(path)

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    },
  )
})

describe('skip link', () => {
  it('targets the main content', () => {
    renderApp('/')

    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skip).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('moves focus to the main content without leaving the page', async () => {
    const user = userEvent.setup()
    renderApp('/about')

    await user.click(screen.getByRole('link', { name: 'Skip to main content' }))

    expect(screen.getByRole('main')).toHaveFocus()
    // With a hash router, following "#main" would have meant a route called "main".
    expect(window.location.hash).toBe('#/about')
  })
})

describe('footer', () => {
  function footer() {
    return within(screen.getByRole('contentinfo'))
  }

  it('names the date and source of the exchange rates, with a link to the source', () => {
    renderApp('/')

    const date = screen.getByRole('contentinfo').querySelector('time')
    expect(date).toHaveAttribute('datetime', RATES.date)
    expect(date).toHaveTextContent('3 Nov 2026')
    expect(footer().getByRole('link', { name: 'ExchangeRate-API' })).toHaveAttribute(
      'href',
      RATES.sourceUrl,
    )
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      'Exchange rates as of 3 Nov 2026, source: ExchangeRate-API.',
    )
  })

  it('says who made it, how, and where the source code is', () => {
    renderApp('/')

    expect(footer().getByText('Made by Rubayet Rezwan')).toBeInTheDocument()
    expect(footer().getByText('Built with Claude Code')).toBeInTheDocument()
    expect(footer().getByRole('link', { name: 'Source code' })).toHaveAttribute(
      'href',
      'https://github.com/rubayetrezwan/arthik',
    )
  })

  it('carries the disclaimer', () => {
    renderApp('/')

    expect(
      footer().getByText(
        'Arthik is an educational tool. It is not financial advice and not a credit score. Your data stays in your browser and is never uploaded.',
      ),
    ).toBeInTheDocument()
  })
})

describe('routes', () => {
  it('sends a visitor with no file of their own from their score to the upload page', () => {
    renderApp('/score/mine')

    expect(window.location.hash).toBe('#/upload')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Use your own transactions' }),
    ).toBeInTheDocument()
  })

  it.each(['/nowhere', '/score/nobody'])('shows a plain "not found" page for %s', (path) => {
    renderApp(path)

    expect(
      screen.getByRole('heading', { level: 1, name: 'There is no page here' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute(
      'href',
      '#/',
    )
  })

  it('names the sample person at the top of their score page', () => {
    renderApp('/score/rahim')

    expect(screen.getByText('Sample: Rahim, construction worker in Singapore')).toBeInTheDocument()
  })
})

describe('sample switcher', () => {
  function switcher() {
    return within(screen.getByRole('navigation', { name: 'Try a sample person' }))
  }

  it('lists the five people on a score page, marking the one shown', () => {
    renderApp('/score/farhana')

    const people = switcher()
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') !== '#/upload')
    expect(people.map((link) => link.getAttribute('href'))).toEqual(
      PERSON_IDS.map((id) => `#/score/${id}`),
    )
    expect(switcher().getByRole('link', { name: 'Farhana' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(switcher().getByRole('link', { name: 'Use your own transactions' })).toHaveAttribute(
      'href',
      '#/upload',
    )
  })

  it('is not shown on other pages', () => {
    renderApp('/about')

    expect(
      screen.queryByRole('navigation', { name: 'Try a sample person' }),
    ).not.toBeInTheDocument()
  })
})
