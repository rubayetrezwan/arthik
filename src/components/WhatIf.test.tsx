import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { convert } from '../domain/currency'
import { nusratLike, tx } from '../domain/fixtures'
import { computeMeasures } from '../domain/measures'
import { computeScore } from '../domain/score'
import { NO_CHANGE, simulate, sliderLimits, type WhatIf as Change } from '../domain/whatif'
import { CURRENCY_CODES, type CurrencyCode, type Dataset } from '../domain/types'
import { formatMoney } from '../i18n/format'
import { I18nProvider } from '../i18n/I18nProvider'
import { LOCALES } from '../i18n/locales'
import { PrefsProvider } from '../state/prefs'
import { CurrencySelect } from './CurrencySelect'
import { LanguageSelect } from './LanguageSelect'
import { WhatIf } from './WhatIf'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
  vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(console.error).not.toHaveBeenCalled()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** The score sheet's own numbers for a dataset, as the page works them out. */
function Harness({ dataset }: { dataset: Dataset }) {
  const measures = useMemo(() => computeMeasures(dataset), [dataset])
  const result = useMemo(() => computeScore(measures), [measures])
  return (
    <>
      <CurrencySelect />
      <LanguageSelect />
      <WhatIf dataset={dataset} measures={measures} result={result} />
    </>
  )
}

function renderWhatIf(dataset: Dataset = nusratLike) {
  const view = render(
    <PrefsProvider>
      <I18nProvider>
        <Harness dataset={dataset} />
      </I18nProvider>
    </PrefsProvider>,
  )
  return {
    ...view,
    rerenderWith: (next: Dataset) =>
      view.rerender(
        <PrefsProvider>
          <I18nProvider>
            <Harness dataset={next} />
          </I18nProvider>
        </PrefsProvider>,
      ),
  }
}

// Sliders are found by position (wants, income, savings), so the tests hold in every language.
const wants = () => screen.getAllByRole('slider')[0]!
const income = () => screen.getAllByRole('slider')[1]!
const savings = () => screen.getAllByRole('slider')[2]!
const liveRegion = () => document.querySelector('[aria-live="polite"]')

/** The score nusratLike would have with a change, worked out by the domain. */
function scoreWith(change: Partial<Change>): number | null {
  return simulate(nusratLike, { ...NO_CHANGE, ...change }).result.score
}

const BASE = computeScore(computeMeasures(nusratLike)).score

describe('WhatIf: the sliders', () => {
  it('has three sliders, the first for wants from 0 to 50 in steps of 5', () => {
    renderWhatIf()

    expect(wants()).toHaveAttribute('min', '0')
    expect(wants()).toHaveAttribute('max', '50')
    expect(wants()).toHaveAttribute('step', '5')
    expect(wants()).toHaveValue('0')
    expect(income()).toHaveValue('0')
    expect(savings()).toHaveValue('0')
  })

  it('moves the wants slider to 20 with four presses of the right arrow, and updates the result', async () => {
    const user = userEvent.setup()
    renderWhatIf()
    expect(screen.getByTestId('whatif-to')).toHaveTextContent(String(BASE))

    wants().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}')

    expect(wants()).toHaveValue('20')
    expect(wants()).toHaveAttribute('aria-valuetext', '20%')
    const to = scoreWith({ cutWantsPct: 20 })
    expect(to).toBeGreaterThan(BASE!)
    expect(screen.getByTestId('whatif-from')).toHaveTextContent(String(BASE))
    expect(screen.getByTestId('whatif-to')).toHaveTextContent(String(to))
    expect(screen.getByText(`+${to! - BASE!} points`)).toBeInTheDocument()
  })

  it('takes the other keys a slider should: left, Home, End, Page Up and Page Down', async () => {
    const user = userEvent.setup()
    renderWhatIf()

    wants().focus()
    await user.keyboard('{End}')
    expect(wants()).toHaveValue('50')
    await user.keyboard('{ArrowLeft}{ArrowDown}')
    expect(wants()).toHaveValue('40')
    await user.keyboard('{Home}{ArrowUp}')
    expect(wants()).toHaveValue('5')
    await user.keyboard('{PageUp}')
    expect(wants()).toHaveValue('10')
    await user.keyboard('{PageDown}{PageDown}')
    expect(wants()).toHaveValue('0')
  })

  it('works in taka steps of a sensible size, up to half the monthly income', async () => {
    const user = userEvent.setup()
    renderWhatIf()

    // 23,000 a month coming in: up to 11,500, in steps of 500.
    expect(sliderLimits(computeMeasures(nusratLike)).extraIncomeMaxBDT).toBe(11_500)
    expect(income()).toHaveAttribute('max', '11500')
    expect(income()).toHaveAttribute('step', '500')
    expect(income()).toHaveAttribute('aria-valuetext', '৳0')

    income().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(income()).toHaveAttribute('aria-valuetext', '৳1,000')
    expect(screen.getByTestId('whatif-to')).toHaveTextContent(
      String(scoreWith({ extraIncomeMonthlyBDT: 1_000 })),
    )

    await user.keyboard('{End}')
    expect(income()).toHaveAttribute('aria-valuetext', '৳11,500')
  })

  it.each(CURRENCY_CODES)(
    'gives the money sliders a nice step in %s, 20 to 50 of them, ending on a whole step',
    (currency: CurrencyCode) => {
      localStorage.setItem('arthik.currency', currency)
      renderWhatIf()

      const limits = sliderLimits(computeMeasures(nusratLike))
      for (const [slider, limitBDT] of [
        [income(), limits.extraIncomeMaxBDT],
        [savings(), limits.addSavingsMaxBDT],
      ] as const) {
        const step = Number(slider.getAttribute('step'))
        const max = Number(slider.getAttribute('max'))
        const positions = Math.round(max / step)
        // 1, 2 or 5 times a power of ten.
        const mantissa = step / 10 ** Math.floor(Math.log10(step) + 1e-9)
        expect([1, 2, 5]).toContainEqual(Math.round(mantissa * 1e6) / 1e6)
        expect(positions).toBeGreaterThanOrEqual(20)
        expect(positions).toBeLessThanOrEqual(50)
        expect(Math.abs(max - positions * step)).toBeLessThan(step * 1e-9)
        expect(max).toBeLessThanOrEqual(convert(limitBDT, 'BDT', currency))
        expect(max + step).toBeGreaterThan(convert(limitBDT, 'BDT', currency))
      }
    },
  )

  it('shows money in the display currency, and simulates it in taka', async () => {
    localStorage.setItem('arthik.currency', 'USD')
    const user = userEvent.setup()
    renderWhatIf()

    const step = Number(income().getAttribute('step'))
    income().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}')

    expect(income()).toHaveAttribute('aria-valuetext', formatMoney(3 * step, 'USD', 'en'))
    expect(screen.getByTestId('whatif-to')).toHaveTextContent(
      String(scoreWith({ extraIncomeMonthlyBDT: convert(3 * step, 'USD', 'BDT') })),
    )
  })

  it('follows the reading direction: in Arabic, the left arrow moves the value up', async () => {
    localStorage.setItem('arthik.locale', 'ar')
    const user = userEvent.setup()
    renderWhatIf()
    await waitFor(() => expect(html.dir).toBe('rtl'))

    wants().focus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowRight}')

    expect(wants()).toHaveValue('5')
  })

  it('turns the savings slider off, and says why, when no savings were entered (R14)', () => {
    renderWhatIf({ ...nusratLike, emergencySavings: null })

    expect(savings()).toBeDisabled()
    expect(savings()).toHaveAccessibleDescription(
      'This one needs your emergency savings, which you can enter with your file.',
    )
    expect(wants()).toBeEnabled()
    expect(income()).toBeEnabled()
  })

  it('turns a money slider with no steps off, and says why', () => {
    // Income but no essential spending: there is nothing to base added savings on.
    const noEssentials: Dataset = {
      ...nusratLike,
      transactions: [
        tx('2026-08-01', 'salary', 40000),
        tx('2026-09-01', 'salary', 40000),
        tx('2026-10-01', 'salary', 40000),
        tx('2026-08-05', 'eating_out', -3000),
        tx('2026-09-05', 'eating_out', -3000),
        tx('2026-10-05', 'eating_out', -3000),
      ],
    }
    renderWhatIf(noEssentials)

    expect(savings()).toBeDisabled()
    expect(savings()).toHaveAccessibleDescription(
      'There is too little here to adjust, so this slider is off.',
    )
    expect(income()).toBeEnabled()
    expect(income()).not.toHaveAccessibleDescription()
  })

  it('shows nothing unless there is a score (R14)', () => {
    const noIncome: Dataset = {
      ...nusratLike,
      transactions: nusratLike.transactions.filter((t) => t.amount < 0),
    }
    renderWhatIf(noIncome)

    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })
})

describe('WhatIf: the live region', () => {
  it('says nothing when a category change moves the score and no slider has moved', async () => {
    vi.useFakeTimers()
    const view = renderWhatIf()
    const region = liveRegion()!
    const changed: Dataset = {
      ...nusratLike,
      transactions: nusratLike.transactions.map((t, i) =>
        i === 0 ? { ...t, amount: t.amount * 2 } : t,
      ),
    }

    view.rerenderWith(changed)
    act(() => vi.advanceTimersByTime(2_000))
    await Promise.resolve()

    expect(region.textContent).toBe('')
  })

  it('says nothing after a slider moved and a category change then reset the sliders', async () => {
    vi.useFakeTimers()
    const view = renderWhatIf()
    fireEvent.keyDown(wants(), { key: 'ArrowRight' })
    act(() => vi.advanceTimersByTime(500))
    await Promise.resolve()
    expect(liveRegion()!.textContent).not.toBe('')

    view.rerenderWith({ ...nusratLike, transactions: [...nusratLike.transactions] })
    act(() => vi.advanceTimersByTime(2_000))
    await Promise.resolve()

    expect(liveRegion()!.textContent).toBe('')
  })
})

describe('WhatIf: the result', () => {
  it('starts with no change, from the score to itself', () => {
    renderWhatIf()

    expect(screen.getByTestId('whatif-from')).toHaveTextContent(String(BASE))
    expect(screen.getByTestId('whatif-to')).toHaveTextContent(String(BASE))
    expect(screen.getByText('No change')).toBeInTheDocument()
    expect(screen.getByText('Still Coping. Healthy starts at 80.')).toBeInTheDocument()
  })

  it('names the band a change would reach', async () => {
    const user = userEvent.setup()
    renderWhatIf()

    wants().focus()
    await user.keyboard('{End}')
    income().focus()
    await user.keyboard('{End}')
    savings().focus()
    await user.keyboard('{End}')

    const to = scoreWith({
      cutWantsPct: 50,
      extraIncomeMonthlyBDT: 11_500,
      addSavingsBDT: Number(savings().getAttribute('max')),
    })
    expect(to).toBeGreaterThanOrEqual(80)
    expect(screen.getByText('That would put you in Healthy.')).toBeInTheDocument()
  })

  it('announces the result politely, once, 400ms after the last change', async () => {
    // Key events are fired directly: user-event waits on timers that fake ones would hold.
    vi.useFakeTimers()
    renderWhatIf()
    const region = liveRegion()!
    const before = region.textContent
    // Nothing is said until a slider has moved.
    expect(before).toBe('')
    expect(region).toHaveClass('visually-hidden')

    const changes: string[] = []
    const observer = new MutationObserver(() => changes.push(region.textContent ?? ''))
    observer.observe(region, { childList: true, characterData: true, subtree: true })

    // Four steps, each 100ms after the last: every one starts the wait again.
    for (let press = 0; press < 4; press += 1) {
      if (press > 0) act(() => vi.advanceTimersByTime(100))
      fireEvent.keyDown(wants(), { key: 'ArrowRight' })
    }
    expect(wants()).toHaveValue('20')
    act(() => vi.advanceTimersByTime(399))
    // The observer reports in a microtask.
    await Promise.resolve()
    expect(region.textContent).toBe(before)
    expect(changes).toEqual([])

    act(() => vi.advanceTimersByTime(1))
    await Promise.resolve()
    const to = scoreWith({ cutWantsPct: 20 })!
    const after = `Your score would go from ${BASE} to ${to}, ${to - BASE!} points higher.`
    expect(region.textContent).toBe(after)

    act(() => vi.advanceTimersByTime(2_000))
    await Promise.resolve()
    observer.disconnect()
    expect(changes).toEqual([after])
  })
})

describe('WhatIf: back to no change (Review Focus 5)', () => {
  async function moveSliders(user: ReturnType<typeof userEvent.setup>) {
    wants().focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    income().focus()
    await user.keyboard('{ArrowRight}')
    expect(wants()).toHaveValue('10')
    expect(screen.queryByText('No change')).not.toBeInTheDocument()
  }

  it('resets the sliders when the currency changes', async () => {
    const user = userEvent.setup()
    renderWhatIf()
    await moveSliders(user)

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')

    expect(wants()).toHaveValue('0')
    expect(income()).toHaveValue('0')
    expect(income().getAttribute('aria-valuetext')).toMatch(/^\$0\.00$/)
    expect(screen.getByText('No change')).toBeInTheDocument()
  })

  it('resets the sliders when the language changes', async () => {
    const user = userEvent.setup()
    renderWhatIf()
    await moveSliders(user)

    await user.selectOptions(screen.getByLabelText('Language'), 'bn')
    await waitFor(() => expect(html.lang).toBe(LOCALES.bn.intl))

    expect(wants()).toHaveValue('0')
    expect(income()).toHaveValue('0')
  })

  it('resets the sliders when the data changes', async () => {
    const user = userEvent.setup()
    const { rerenderWith } = renderWhatIf()
    await moveSliders(user)

    rerenderWith({ ...nusratLike, transactions: [...nusratLike.transactions] })

    expect(wants()).toHaveValue('0')
    expect(income()).toHaveValue('0')
  })
})
