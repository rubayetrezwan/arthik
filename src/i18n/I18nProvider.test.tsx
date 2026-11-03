import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormattedMessage } from 'react-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrefsProvider, usePrefs } from '../state/prefs'
import { I18nProvider } from './I18nProvider'
import { loadFonts } from './fonts'
import { loadMessages } from './loadMessages'
import { LOCALE_CODES, LOCALES } from './locales'
import en from './messages/en.json'

vi.mock('./fonts', () => ({ loadFonts: vi.fn() }))
vi.mock('./loadMessages', () => ({ loadMessages: vi.fn() }))

const html = document.documentElement

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function LanguageButtons() {
  const { setLocale } = usePrefs()

  return (
    <>
      <h1>
        <FormattedMessage id="app.name" />
      </h1>
      {LOCALE_CODES.map((l) => (
        <button key={l} onClick={() => setLocale(l)}>
          {LOCALES[l].nativeName}
        </button>
      ))}
    </>
  )
}

function renderApp() {
  return render(
    <PrefsProvider>
      <I18nProvider>
        <LanguageButtons />
      </I18nProvider>
    </PrefsProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
  vi.mocked(loadFonts).mockResolvedValue(undefined)
  vi.mocked(loadMessages).mockResolvedValue(en)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.mocked(loadFonts).mockReset()
  vi.mocked(loadMessages).mockReset()
})

describe('I18nProvider', () => {
  it('shows the English messages and marks the page English and left to right', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'Arthik' })).toBeInTheDocument()
    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')
  })

  it('turns the page right to left for Arabic and back again for English', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'العربية' }))
    await waitFor(() => expect(html.dir).toBe('rtl'))
    expect(html.lang).toBe('ar')

    await user.click(screen.getByRole('button', { name: 'English' }))
    await waitFor(() => expect(html.dir).toBe('ltr'))
    expect(html.lang).toBe('en')
  })

  it.each(LOCALE_CODES)('sets the page language and direction for %s', async (l) => {
    const user = userEvent.setup()
    localStorage.setItem('arthik.locale', 'fr')
    renderApp()

    await user.click(screen.getByRole('button', { name: LOCALES[l].nativeName }))

    await waitFor(() => expect(html.lang).toBe(LOCALES[l].intl))
    expect(html.dir).toBe(LOCALES[l].dir)
  })

  it('opens in the remembered language', async () => {
    localStorage.setItem('arthik.locale', 'ar')

    renderApp()

    await waitFor(() => expect(html.dir).toBe('rtl'))
    expect(html.lang).toBe('ar')
    expect(loadMessages).toHaveBeenCalledWith('ar')
  })

  it('loads the fonts for the language it switches to', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'हिन्दी' }))

    await waitFor(() => expect(loadFonts).toHaveBeenCalledWith('hi'))
  })

  it('shows the translated messages once they have loaded', async () => {
    vi.mocked(loadMessages).mockResolvedValue({ ...en, 'app.name': 'আর্থিক' })
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'বাংলা' }))

    expect(await screen.findByRole('heading', { name: 'আর্থিক' })).toBeInTheDocument()
    expect(html.lang).toBe('bn-BD')
  })

  it('keeps the previous language on screen while the new one loads', async () => {
    const messages = deferred<typeof en>()
    vi.mocked(loadMessages).mockReturnValue(messages.promise)
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'العربية' }))

    expect(screen.getByRole('heading', { name: 'Arthik' })).toBeInTheDocument()
    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')

    messages.resolve({ ...en, 'app.name': 'أرثيك' })

    expect(await screen.findByRole('heading', { name: 'أرثيك' })).toBeInTheDocument()
    expect(html.lang).toBe('ar')
    expect(html.dir).toBe('rtl')
  })

  it('waits for the fonts before it switches', async () => {
    const fonts = deferred<void>()
    vi.mocked(loadFonts).mockReturnValue(fonts.promise)
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'العربية' }))

    expect(loadFonts).toHaveBeenCalledWith('ar')
    expect(html.dir).toBe('ltr')

    fonts.resolve()

    await waitFor(() => expect(html.dir).toBe('rtl'))
  })

  it('ends in the last language chosen when an earlier one loads late', async () => {
    const slow = deferred<typeof en>()
    vi.mocked(loadMessages).mockImplementation((l) =>
      l === 'ar' ? slow.promise : Promise.resolve({ ...en, 'app.name': 'আর্থিক' }),
    )
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'العربية' }))
    await user.click(screen.getByRole('button', { name: 'বাংলা' }))
    expect(await screen.findByRole('heading', { name: 'আর্থিক' })).toBeInTheDocument()

    await act(async () => {
      slow.resolve({ ...en, 'app.name': 'أرثيك' })
    })

    expect(screen.getByRole('heading', { name: 'আর্থিক' })).toBeInTheDocument()
    expect(html.lang).toBe('bn-BD')
    expect(html.dir).toBe('ltr')
  })

  it('does not log an error when a language has no translations yet', async () => {
    const error = vi.spyOn(console, 'error')
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Français' }))
    await waitFor(() => expect(html.lang).toBe('fr'))

    expect(screen.getByRole('heading', { name: 'Arthik' })).toBeInTheDocument()
    expect(error).not.toHaveBeenCalled()
  })
})
