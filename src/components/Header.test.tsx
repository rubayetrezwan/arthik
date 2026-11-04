import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENCY_CODES } from '../domain/types'
import { LOCALE_CODES, LOCALES } from '../i18n/locales'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
})

function header() {
  return within(screen.getByRole('banner'))
}

describe('Header', () => {
  it('has the wordmark, linking to the home page', () => {
    renderApp('/about')

    const home = header().getByRole('link', { name: 'Arthik আর্থিক' })
    expect(home).toHaveAttribute('href', '#/')
  })

  it('shows the three main links', () => {
    renderApp('/')

    const nav = header().getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Your score',
      'How the score works',
      'About',
    ])
    expect(links[1]).toHaveAttribute('href', '#/how-it-works')
    expect(links[2]).toHaveAttribute('href', '#/about')
  })

  it('offers the seven languages, each by its own name', () => {
    renderApp('/')

    const select = header().getByRole('combobox', { name: 'Language' })
    const options = within(select).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(
      LOCALE_CODES.map((l) => LOCALES[l].nativeName),
    )
    expect(select).toHaveValue('en')
  })

  it('offers the eleven currencies in the global order', () => {
    renderApp('/')

    const select = header().getByRole('combobox', { name: 'Currency' })
    const options = within(select).getAllByRole<HTMLOptionElement>('option')
    expect(options.map((option) => option.value)).toEqual([...CURRENCY_CODES])
    expect(options[0]).toHaveTextContent('৳ BDT')
    expect(select).toHaveValue('BDT')
  })

  it('switches to Bengali when বাংলা is chosen', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const select = header().getByRole('combobox', { name: 'Language' })

    await user.selectOptions(select, 'বাংলা')

    // setLocale('bn'): the choice is shown, remembered and applied to the page.
    expect(select).toHaveValue('bn')
    expect(localStorage.getItem('arthik.locale')).toBe('bn')
    await waitFor(() => expect(html.lang).toBe('bn-BD'))
  })

  it('remembers the currency chosen', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const select = header().getByRole('combobox', { name: 'Currency' })

    await user.selectOptions(select, 'GBP')

    expect(select).toHaveValue('GBP')
    expect(localStorage.getItem('arthik.currency')).toBe('GBP')
  })

  it('marks "Your score" as the page on any score page', () => {
    renderApp('/score/tanvir')

    const nav = header().getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Your score' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current')
  })

  it('takes "Your score" back to the person looked at last', async () => {
    const user = userEvent.setup()
    renderApp('/score/arif')
    const nav = header().getByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('link', { name: 'About' }))

    expect(within(nav).getByRole('link', { name: 'Your score' })).toHaveAttribute(
      'href',
      '#/score/arif',
    )
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
