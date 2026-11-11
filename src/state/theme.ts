import { safeGet } from './storage'

// The colour theme: the device's choice (the default, followed live), or light or dark
// whatever the device says. public/theme.js applies the remembered choice before the first
// paint, so it reads the same key and writes the same colours: keep the two in step.

export const THEME_KEY = 'arthik.theme'

export const THEME_CHOICES = ['system', 'light', 'dark'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]
export type Theme = Exclude<ThemeChoice, 'system'>

/** The browser bar colour for each theme: the page's paper (--bg in tokens.css). */
export const THEME_COLORS: Record<Theme, string> = { light: '#F4EFE4', dark: '#191612' }

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isThemeChoice(value: string): value is ThemeChoice {
  return (THEME_CHOICES as readonly string[]).includes(value)
}

/** The remembered choice, or "system". */
export function readStoredTheme(): ThemeChoice {
  const value = safeGet(THEME_KEY)
  return value !== null && isThemeChoice(value) ? value : 'system'
}

/** The device's preference, or null where the browser cannot say. */
function deviceQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== 'system') return choice
  return deviceQuery()?.matches ? 'dark' : 'light'
}

/** Sets the theme on the page and the browser bar colour to match. */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
}

/**
 * Applies `choice` now and, while it is "system", whenever the device changes its mind.
 * Returns the function that stops listening.
 */
export function followTheme(choice: ThemeChoice): () => void {
  applyTheme(resolveTheme(choice))
  const query = choice === 'system' ? deviceQuery() : null
  if (!query) return () => undefined
  const onChange = (event: MediaQueryListEvent) => applyTheme(event.matches ? 'dark' : 'light')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
