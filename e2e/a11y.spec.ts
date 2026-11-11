import AxeBuilder from '@axe-core/playwright'
import { expect, open, test, uploadFile, type Locale } from './fixtures'

const ROUTES = ['/', '/score/nusrat', '/score/mine', '/upload', '/how-it-works', '/about', '/nowhere']

for (const theme of ['light', 'dark'] as const) {
  for (const locale of ['en', 'ar'] as Locale[]) {
    for (const route of ROUTES) {
      test(`${theme} ${locale} ${route}: no serious or critical accessibility violations`, async ({ page }) => {
        await page.addInitScript((chosen) => {
          try {
            localStorage.setItem('arthik.theme', chosen)
          } catch {
            // Storage may be unavailable; the page then follows the device.
          }
        }, theme)
        if (route === '/score/mine') {
          await open(page, '/upload', locale)
          await page.locator('input[type="file"]').setInputFiles('public/arthik-template.csv')
          await page.locator('form button[type="submit"]').click()
        } else {
          await open(page, route, locale)
        }
        if (route.startsWith('/score/')) await page.getByTestId('score').waitFor()
        await page.evaluate(() => document.fonts.ready.then(() => undefined))

        const { violations } = await new AxeBuilder({ page }).analyze()
        const serious = violations.filter(
          (violation) => violation.impact === 'serious' || violation.impact === 'critical',
        )
        expect(
          serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
        ).toEqual([])
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      })
    }
  }
}

test('the upload page with a file chosen and one with errors have no serious violations', async ({
  page,
}) => {
  await uploadFile(page, {
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'date,description,amount,currency,category\n2026-08-01,Salary,55000,BDT,\nnot-a-date,Rent,-18000,BDT,\n',
    ),
  })
  await expect(page.getByText('Row 3:')).toBeVisible()

  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(
    violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => v.id),
  ).toEqual([])
})

// The colour theme: set before the first paint by public/theme.js, so a reload never flashes.
test.describe('colour theme', () => {
  test('a stored dark theme is on the page before the app script runs, and survives a reload', async ({
    page,
  }) => {
    await page.goto('./')
    await page.locator('select:has(option[value="dark"])').selectOption('dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    // Record the theme at the first moment the page's own module could run: as soon as the
    // root element exists, before any module script (they are deferred).
    await page.addInitScript(() => {
      const seen: (string | null)[] = []
      Object.assign(window, { themeSeen: seen })
      new MutationObserver((_, observer) => {
        if (document.body) {
          seen.push(document.documentElement.getAttribute('data-theme'))
          observer.disconnect()
        }
      }).observe(document, { childList: true, subtree: true })
    })
    await page.reload()
    await page.locator('main').waitFor()

    const seen = await page.evaluate(() => (window as unknown as { themeSeen: string[] }).themeSeen)
    expect(seen).toEqual(['dark'])
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#191612')
    const paper = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(paper).toBe('rgb(25, 22, 18)')
  })

  test('"Auto" follows the device, live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('./')
    await page.locator('main').waitFor()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    expect(await page.locator('meta[name="theme-color"]').getAttribute('content')).toBe('#F4EFE4')

    // A chosen theme holds whatever the device says.
    await page.locator('select:has(option[value="dark"])').selectOption('dark')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
