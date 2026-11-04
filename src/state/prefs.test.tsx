import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrefsProvider, readStoredLocale, usePrefs } from './prefs'

function Probe() {
  const { locale, setLocale, currency, setCurrency } = usePrefs()

  return (
    <>
      <p>locale: {locale}</p>
      <p>currency: {currency}</p>
      <button onClick={() => setLocale('ar')}>Arabic</button>
      <button onClick={() => setLocale('bn')}>Bengali</button>
      <button onClick={() => setCurrency('USD')}>Dollars</button>
    </>
  )
}

function renderProbe() {
  return render(
    <PrefsProvider>
      <Probe />
    </PrefsProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PrefsProvider', () => {
  it('starts in English and taka', () => {
    renderProbe()

    expect(screen.getByText('locale: en')).toBeInTheDocument()
    expect(screen.getByText('currency: BDT')).toBeInTheDocument()
  })

  it('does not guess the language from the browser', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('bn-BD')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['bn-BD', 'bn'])

    renderProbe()

    expect(screen.getByText('locale: en')).toBeInTheDocument()
    expect(screen.getByText('currency: BDT')).toBeInTheDocument()
  })

  it('remembers the language and currency on the device', async () => {
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByRole('button', { name: 'Arabic' }))
    await user.click(screen.getByRole('button', { name: 'Dollars' }))

    expect(screen.getByText('locale: ar')).toBeInTheDocument()
    expect(screen.getByText('currency: USD')).toBeInTheDocument()
    expect(localStorage.getItem('arthik.locale')).toBe('ar')
    expect(localStorage.getItem('arthik.currency')).toBe('USD')
  })

  it('starts from the remembered choices', () => {
    localStorage.setItem('arthik.locale', 'bn')
    localStorage.setItem('arthik.currency', 'GBP')

    renderProbe()

    expect(screen.getByText('locale: bn')).toBeInTheDocument()
    expect(screen.getByText('currency: GBP')).toBeInTheDocument()
  })

  it('ignores remembered values it does not know', () => {
    localStorage.setItem('arthik.locale', 'klingon')
    localStorage.setItem('arthik.currency', 'XYZ')

    renderProbe()

    expect(screen.getByText('locale: en')).toBeInTheDocument()
    expect(screen.getByText('currency: BDT')).toBeInTheDocument()
  })

  it('ignores remembered values that are only inherited object keys', () => {
    localStorage.setItem('arthik.locale', 'constructor')
    localStorage.setItem('arthik.currency', 'toString')

    renderProbe()

    expect(screen.getByText('locale: en')).toBeInTheDocument()
    expect(screen.getByText('currency: BDT')).toBeInTheDocument()
  })

  describe('when the browser blocks storage', () => {
    function blocked(): never {
      throw new DOMException('Storage is blocked', 'SecurityError')
    }

    it('still shows the defaults and lets the visitor change them, without logging', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
      const error = vi.spyOn(console, 'error')
      const user = userEvent.setup()

      renderProbe()

      expect(screen.getByText('locale: en')).toBeInTheDocument()
      expect(screen.getByText('currency: BDT')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Bengali' }))
      await user.click(screen.getByRole('button', { name: 'Dollars' }))

      expect(screen.getByText('locale: bn')).toBeInTheDocument()
      expect(screen.getByText('currency: USD')).toBeInTheDocument()
      expect(error).not.toHaveBeenCalled()
    })

    it('copes with the localStorage property itself throwing', async () => {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked)
      const error = vi.spyOn(console, 'error')
      const user = userEvent.setup()

      renderProbe()
      await user.click(screen.getByRole('button', { name: 'Arabic' }))

      expect(screen.getByText('locale: ar')).toBeInTheDocument()
      expect(screen.getByText('currency: BDT')).toBeInTheDocument()
      expect(error).not.toHaveBeenCalled()
    })
  })
})

describe('usePrefs', () => {
  it('says so when it is used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/PrefsProvider/)
  })
})

describe('readStoredLocale', () => {
  it('reads the remembered language, for the page to set up before it first draws', () => {
    localStorage.setItem('arthik.locale', 'ar')

    expect(readStoredLocale()).toBe('ar')
  })

  it('gives English when nothing is remembered, or something unknown is', () => {
    expect(readStoredLocale()).toBe('en')

    localStorage.setItem('arthik.locale', 'klingon')
    expect(readStoredLocale()).toBe('en')
  })

  it('gives English when storage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    })

    expect(readStoredLocale()).toBe('en')
  })
})
