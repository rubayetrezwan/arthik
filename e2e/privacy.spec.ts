import { expect, test } from './fixtures'

// The Content-Security-Policy the build writes into the page (vite.config.ts). It is a meta tag,
// so the browser enforces it wherever the site is hosted, GitHub Pages included.

test.beforeEach(async ({ page }) => {
  // Every policy violation on the page, from the very first script.
  await page.addInitScript(() => {
    const violations: string[] = []
    Object.assign(window, { cspViolations: violations })
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
})

const violations = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations)

test('the built page carries a policy that keeps it to its own origin', async ({ page }) => {
  await page.goto('./')
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(policy).toContain("default-src 'self'")
  expect(policy).toContain("script-src 'self'")
  expect(policy).toContain("connect-src 'self'")
  expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/)
})

test('the app works under the policy, with nothing blocked', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.goto('./#/score/nusrat')
  await expect(page.getByTestId('score')).toBeVisible()
  await page.locator('select:has(option[value="ar"])').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  expect(await violations(page)).toEqual([])
})

test('a request to another site is blocked by the browser', async ({ page, problems }) => {
  await page.goto('./')
  const outcome = await page.evaluate(async () => {
    try {
      await fetch('https://example.com/')
      return 'sent'
    } catch {
      return 'blocked'
    }
  })
  expect(outcome).toBe('blocked')
  await expect.poll(() => violations(page)).toEqual(['connect-src https://example.com/'])

  // The browser reports the blocked request as a console error. That one is expected here, so
  // it is taken out of what the fixture checks; any other error still fails the test.
  const expected = problems.filter((problem) => problem.includes('example.com'))
  expect(expected.length).toBeGreaterThan(0)
  problems.splice(0, problems.length, ...problems.filter((problem) => !expected.includes(problem)))
})

test('only the three preferences are ever stored: language, currency and colour theme', async ({
  page,
}) => {
  await page.goto('./#/upload')
  await page.locator('select:has(option[value="USD"])').selectOption('USD')
  await page.locator('select:has(option[value="dark"])').selectOption('dark')
  await page.locator('select:has(option[value="bn"])').selectOption('bn')
  await page.locator('input[type="file"]').setInputFiles('public/arthik-template.csv')
  await page.locator('form button[type="submit"]').click()
  await expect(page.getByTestId('score')).toBeVisible()

  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage).sort(),
    session: sessionStorage.length,
    cookies: document.cookie,
  }))
  expect(stored).toEqual({
    local: ['arthik.currency', 'arthik.locale', 'arthik.theme'],
    session: 0,
    cookies: '',
  })
})
