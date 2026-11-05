import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

// This file never imports the eager samples, so a person's data really is fetched on demand.
beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

describe('a score page while the person is being fetched', () => {
  it('holds the place with a quiet status, then shows the score', async () => {
    vi.spyOn(console, 'error')
    renderApp('/score/rahim')

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Loading this person’s figures…',
    )
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()

    const main = within(screen.getByRole('main'))
    expect(await main.findByTestId('score')).toHaveTextContent(/\d/)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(console.error).not.toHaveBeenCalled()
  })
})
