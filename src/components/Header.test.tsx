import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CURRENCY_CODES, type Dataset } from '../domain/types'
import { I18nProvider } from '../i18n/I18nProvider'
import { LOCALE_CODES, LOCALES } from '../i18n/locales'
import { PrefsProvider } from '../state/prefs'
import { SessionProvider, useSession } from '../state/session'
import { renderApp } from '../test/renderApp'
import { Header } from './Header'

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

function scoreLink() {
  const nav = header().getByRole('navigation', { name: 'Main' })
  return within(nav).getByRole('link', { name: 'Score' })
}

const ownFile: Dataset = { key: 'mine', transactions: [], emergencySavings: null }

/** Puts a file of the visitor's own into the session, as the upload page will. */
function WithOwnFile() {
  const { setUpload } = useSession()
  useEffect(() => setUpload(ownFile), [setUpload])
  return null
}

/** The header alone, at a route, for a visitor who has brought their own file. */
function renderHeaderWithOwnFile(path: string) {
  return render(
    <PrefsProvider>
      <SessionProvider>
        <I18nProvider>
          <MemoryRouter initialEntries={[path]}>
            <WithOwnFile />
            <Header />
          </MemoryRouter>
        </I18nProvider>
      </SessionProvider>
    </PrefsProvider>,
  )
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
      'Score',
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

  it('offers the colour theme beside the language and currency, following the device at first', () => {
    renderApp('/')
    const select = header().getByRole('combobox', { name: 'Colour theme' })

    const options = within(select).getAllByRole<HTMLOptionElement>('option')
    expect(options.map((option) => option.textContent)).toEqual(['Auto', 'Light', 'Dark'])
    expect(select).toHaveValue('system')
  })

  it('switches to the dark theme and remembers it', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const select = header().getByRole('combobox', { name: 'Colour theme' })

    await user.selectOptions(select, 'Dark')

    expect(select).toHaveValue('dark')
    expect(localStorage.getItem('arthik.theme')).toBe('dark')
    expect(html.dataset.theme).toBe('dark')
  })

  it('marks "Score" as the page when it is the sample on screen', () => {
    renderApp('/score/tanvir')

    expect(scoreLink()).toHaveAttribute('href', '#/score/tanvir')
    expect(scoreLink()).toHaveAttribute('aria-current', 'page')
    const nav = header().getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'About' })).not.toHaveAttribute('aria-current')
  })

  it('does not mark "Score" on the page for a person who does not exist', () => {
    renderApp('/score/nobody')

    expect(scoreLink()).not.toHaveAttribute('aria-current')
  })

  it("leads to the visitor's own file once there is one, and marks it only there", async () => {
    const { unmount } = renderHeaderWithOwnFile('/score/tanvir')

    await waitFor(() => expect(scoreLink()).toHaveAttribute('href', '/score/mine'))
    expect(scoreLink()).not.toHaveAttribute('aria-current')
    unmount()

    renderHeaderWithOwnFile('/score/mine')
    await waitFor(() => expect(scoreLink()).toHaveAttribute('aria-current', 'page'))
  })

  it('takes "Score" back to the person looked at last', async () => {
    const user = userEvent.setup()
    renderApp('/score/arif')
    const nav = header().getByRole('navigation', { name: 'Main' })

    await user.click(within(nav).getByRole('link', { name: 'About' }))

    expect(within(nav).getByRole('link', { name: 'Score' })).toHaveAttribute(
      'href',
      '#/score/arif',
    )
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
