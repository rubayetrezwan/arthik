import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as summaryValuesModule from '../data/samples/summaryValues'
import { I18nProvider } from '../i18n/I18nProvider'
import { PrefsProvider } from '../state/prefs'
import { useHabitsFigures } from './useHabitsFigures'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))
vi.mock('../data/samples/summaryValues', async (importOriginal) => {
  const original = await importOriginal<typeof summaryValuesModule>()
  return { ...original, summaryValues: vi.fn(original.summaryValues) }
})

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.mocked(summaryValuesModule.summaryValues).mockClear()
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <I18nProvider>{children}</I18nProvider>
    </PrefsProvider>
  )
}

describe('useHabitsFigures', () => {
  it('shows a dash for each figure until the two people have loaded, then the figures as text', async () => {
    const { result } = renderHook(() => useHabitsFigures(), { wrapper })

    expect(Object.keys(result.current).sort()).toEqual(['incomeMultiple', 'sentHomeShare'])
    await waitFor(() => expect(result.current.incomeMultiple).toMatch(/\d/))
    expect(result.current.sentHomeShare).toMatch(/\d/)
  })

  it('works the figures out once, and hands back the same object on every later render', async () => {
    const { result, rerender } = renderHook(() => useHabitsFigures(), { wrapper })
    await waitFor(() => expect(result.current.sentHomeShare).toMatch(/\d/))
    const first = result.current
    const calls = vi.mocked(summaryValuesModule.summaryValues).mock.calls.length
    expect(calls).toBeGreaterThan(0)

    rerender()
    rerender()

    expect(result.current).toBe(first)
    expect(vi.mocked(summaryValuesModule.summaryValues).mock.calls.length).toBe(calls)
  })
})
