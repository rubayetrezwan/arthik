import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FormattedMessage } from 'react-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrefsProvider, usePrefs } from '../state/prefs'
import { I18nProvider, useLocale, type PreloadedLanguage } from './I18nProvider'
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

/** Shows the language that was asked for next to the one that is on screen. */
function Status() {
  const { locale: asked } = usePrefs()
  const shown = useLocale()

  return (
    <p>
      asked {asked}, shown {shown}
    </p>
  )
}

function renderApp(initial?: PreloadedLanguage) {
  return render(
    <PrefsProvider>
      <I18nProvider initial={initial}>
        <LanguageButtons />
        <Status />
      </I18nProvider>
    </PrefsProvider>,
  )
}

/** Collects every change made to the page's lang and dir attributes. */
function watchPageAttributes() {
  const changes: MutationRecord[] = []
  const observer = new MutationObserver((records) => changes.push(...records))
  observer.observe(html, { attributes: true, attributeFilter: ['lang', 'dir'] })
  return {
    changes() {
      changes.push(...observer.takeRecords())
      return changes
    },
    stop: () => observer.disconnect(),
  }
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
    // Start somewhere else, with the page already showing it, so the check cannot pass
    // on what was there before the click.
    const start = l === 'fr' ? 'es' : 'fr'
    const user = userEvent.setup()
    localStorage.setItem('arthik.locale', start)
    renderApp()
    await waitFor(() => expect(html.lang).toBe(LOCALES[start].intl))

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

  it('tells components which language is on screen, not the one asked for', async () => {
    const messages = deferred<typeof en>()
    vi.mocked(loadMessages).mockReturnValue(messages.promise)
    const user = userEvent.setup()
    renderApp()
    expect(screen.getByText('asked en, shown en')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'العربية' }))

    expect(screen.getByText('asked ar, shown en')).toBeInTheDocument()

    messages.resolve(en)

    expect(await screen.findByText('asked ar, shown ar')).toBeInTheDocument()
  })

  it('does not rewrite a page language and direction that already match', async () => {
    const attributes = watchPageAttributes()
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('asked en, shown en')

    expect(attributes.changes()).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'العربية' }))
    await screen.findByText('asked ar, shown ar')

    // Only the switch itself wrote anything: one change each for lang and dir.
    expect(attributes.changes()).toHaveLength(2)
    attributes.stop()
  })

  it('keeps a page language and direction that were set early for the saved language', async () => {
    html.lang = 'ar'
    html.dir = 'rtl'
    localStorage.setItem('arthik.locale', 'ar')
    const messages = deferred<typeof en>()
    vi.mocked(loadMessages).mockReturnValue(messages.promise)
    const attributes = watchPageAttributes()

    renderApp()

    expect(html.lang).toBe('ar')
    expect(html.dir).toBe('rtl')
    expect(screen.getByText('asked ar, shown en')).toBeInTheDocument()

    messages.resolve(en)
    await screen.findByText('asked ar, shown ar')

    expect(html.lang).toBe('ar')
    expect(html.dir).toBe('rtl')
    expect(attributes.changes()).toHaveLength(0)
    attributes.stop()
  })

  it('shows a language loaded before it mounted from the very first render', () => {
    html.lang = 'ar'
    html.dir = 'rtl'
    localStorage.setItem('arthik.locale', 'ar')

    renderApp({ locale: 'ar', messages: { ...en, 'app.name': 'أرثيك' } })

    // No await: the first frame is already in the visitor's language.
    expect(screen.getByRole('heading', { name: 'أرثيك' })).toBeInTheDocument()
    expect(screen.getByText('asked ar, shown ar')).toBeInTheDocument()
    expect(loadMessages).not.toHaveBeenCalled()
  })

  it('ignores a preloaded language that is not the one asked for', async () => {
    localStorage.setItem('arthik.locale', 'bn')

    renderApp({ locale: 'ar', messages: { ...en, 'app.name': 'أرثيك' } })

    expect(screen.getByRole('heading', { name: 'Arthik' })).toBeInTheDocument()
    await waitFor(() => expect(html.lang).toBe('bn-BD'))
    expect(loadMessages).toHaveBeenCalledWith('bn')
  })

  it('does not fetch a language again when the visitor returns to it', async () => {
    const slow = deferred<typeof en>()
    vi.mocked(loadMessages).mockImplementation((l) =>
      l === 'ar' ? slow.promise : Promise.resolve(en),
    )
    const user = userEvent.setup()
    renderApp()
    await screen.findByText('asked en, shown en')
    vi.mocked(loadMessages).mockClear()

    await user.click(screen.getByRole('button', { name: 'العربية' }))
    await user.click(screen.getByRole('button', { name: 'English' }))

    expect(await screen.findByText('asked en, shown en')).toBeInTheDocument()
    expect(loadMessages).toHaveBeenCalledTimes(1)
    expect(loadMessages).toHaveBeenCalledWith('ar')
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

describe('useLocale', () => {
  it('says so when it is used outside the provider', () => {
    function Lonely() {
      useLocale()
      return null
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Lonely />)).toThrow(/I18nProvider/)
  })
})
