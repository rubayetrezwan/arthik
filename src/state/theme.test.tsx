import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrefsProvider, usePrefs } from './prefs'
import { readStoredTheme, THEME_COLORS } from './theme'

const html = document.documentElement

/** A stand-in for matchMedia whose dark-mode answer the test can flip, as a device would. */
function fakeColourScheme(dark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    get matches() {
      return dark
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (event: MediaQueryListEvent) => void) =>
      listeners.delete(fn),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return {
    set(next: boolean) {
      dark = next
      for (const fn of listeners) fn({ matches: next } as MediaQueryListEvent)
    },
    listeners,
  }
}

function themeColour() {
  return document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
}

function Probe() {
  const { theme, setTheme } = usePrefs()
  return (
    <>
      <p>theme: {theme}</p>
      <button onClick={() => setTheme('dark')}>Dark</button>
      <button onClick={() => setTheme('light')}>Light</button>
      <button onClick={() => setTheme('system')}>System</button>
    </>
  )
}

const renderProbe = () =>
  render(
    <PrefsProvider>
      <Probe />
    </PrefsProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  html.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#F4EFE4">'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the colour theme', () => {
  it('follows the device by default', () => {
    fakeColourScheme(true)
    renderProbe()

    expect(screen.getByText('theme: system')).toBeInTheDocument()
    expect(html.dataset.theme).toBe('dark')
    expect(themeColour()).toBe(THEME_COLORS.dark)
  })

  it('keeps following the device while it is on "system"', () => {
    const device = fakeColourScheme(false)
    renderProbe()
    expect(html.dataset.theme).toBe('light')

    act(() => device.set(true))
    expect(html.dataset.theme).toBe('dark')
    expect(themeColour()).toBe(THEME_COLORS.dark)

    act(() => device.set(false))
    expect(html.dataset.theme).toBe('light')
    expect(themeColour()).toBe(THEME_COLORS.light)
  })

  it('holds a chosen theme whatever the device says, and remembers it', async () => {
    const device = fakeColourScheme(false)
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(html.dataset.theme).toBe('dark')
    expect(localStorage.getItem('arthik.theme')).toBe('dark')

    act(() => device.set(false))
    expect(html.dataset.theme).toBe('dark')
    expect(device.listeners.size).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Light' }))
    expect(html.dataset.theme).toBe('light')
    expect(themeColour()).toBe(THEME_COLORS.light)
    expect(localStorage.getItem('arthik.theme')).toBe('light')
  })

  it('starts from the remembered theme', () => {
    fakeColourScheme(false)
    localStorage.setItem('arthik.theme', 'dark')
    renderProbe()

    expect(screen.getByText('theme: dark')).toBeInTheDocument()
    expect(html.dataset.theme).toBe('dark')
  })

  it('works with no matchMedia at all, as light', () => {
    vi.stubGlobal('matchMedia', undefined)
    renderProbe()

    expect(html.dataset.theme).toBe('light')
  })

  it('still changes theme, without logging, when storage throws', async () => {
    fakeColourScheme(false)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    })
    const error = vi.spyOn(console, 'error')
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(html.dataset.theme).toBe('dark')
    expect(error).not.toHaveBeenCalled()
  })
})

describe('readStoredTheme', () => {
  it('reads a known choice and gives "system" for anything else', () => {
    expect(readStoredTheme()).toBe('system')
    localStorage.setItem('arthik.theme', 'light')
    expect(readStoredTheme()).toBe('light')
    localStorage.setItem('arthik.theme', 'sepia')
    expect(readStoredTheme()).toBe('system')
    localStorage.setItem('arthik.theme', 'constructor')
    expect(readStoredTheme()).toBe('system')
  })
})
