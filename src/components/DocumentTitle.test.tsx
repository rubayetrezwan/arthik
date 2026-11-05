import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  document.title = 'Arthik'
})

describe('the page title (WCAG 2.4.2)', () => {
  it.each([
    ['/', 'Home · Arthik'],
    ['/score/nusrat', 'Score for Nusrat · Arthik'],
    ['/upload', 'Use your own transactions · Arthik'],
    ['/how-it-works', 'How the score works · Arthik'],
    ['/about', 'About · Arthik'],
    ['/nowhere', 'There is no page here · Arthik'],
  ])('names %s', async (path, title) => {
    renderApp(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('follows the page and the language', async () => {
    const user = userEvent.setup()
    renderApp('/about')
    await waitFor(() => expect(document.title).toBe('About · Arthik'))

    await user.click(screen.getAllByRole('link', { name: /^Arthik/ })[0]!)
    await waitFor(() => expect(document.title).toBe('Home · Arthik'))

    await user.selectOptions(screen.getByLabelText('Language'), 'es')
    await waitFor(() => expect(document.title).toBe('Inicio · Arthik'))
  })
})
