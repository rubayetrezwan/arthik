import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import script from '../public/theme.js?raw'
import indexHtml from '../index.html?raw'
import { THEME_COLORS } from './state/theme'

const html = document.documentElement
const run = () => new Function(script)()
const bar = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

function device(dark: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: dark })))
}

beforeEach(() => {
  localStorage.clear()
  html.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#F4EFE4">'
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('public/theme.js, run before the first paint', () => {
  it('follows the device when nothing is remembered', () => {
    device(true)
    run()
    expect(html.dataset.theme).toBe('dark')
    expect(bar()).toBe(THEME_COLORS.dark)
  })

  it('uses the remembered choice over the device', () => {
    device(true)
    localStorage.setItem('arthik.theme', 'light')
    run()
    expect(html.dataset.theme).toBe('light')
    expect(bar()).toBe(THEME_COLORS.light)

    device(false)
    localStorage.setItem('arthik.theme', 'dark')
    run()
    expect(html.dataset.theme).toBe('dark')
    expect(bar()).toBe(THEME_COLORS.dark)
  })

  it('falls back to light when storage throws and matchMedia is missing', () => {
    vi.stubGlobal('matchMedia', undefined)
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    })
    expect(run).not.toThrow()
    expect(html.dataset.theme).toBe('light')
  })

  it('is loaded by index.html as a blocking, same-origin script after the theme-color meta', () => {
    const page = new DOMParser().parseFromString(indexHtml, 'text/html')
    const tag = page.head.querySelector('script[src$="theme.js"]')
    expect(tag).not.toBeNull()
    expect(tag?.hasAttribute('async') || tag?.hasAttribute('defer')).toBe(false)
    expect(tag?.getAttribute('type')).toBeNull()
    const order = [...page.head.children]
    expect(order.indexOf(tag!)).toBeGreaterThan(
      order.indexOf(page.head.querySelector('meta[name="theme-color"]')!),
    )
  })
})
