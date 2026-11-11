import { mkdirSync } from 'node:fs'
import { open, test, type Locale } from './fixtures'

/**
 * Regenerates the pictures in docs/screenshots. Run on purpose, never in the default suite:
 *   npx playwright test --grep @screenshots --project=desktop-chrome
 *   npx playwright test --grep @screenshots --project=android
 */
const OUT = 'docs/screenshots'

test.beforeAll(() => mkdirSync(OUT, { recursive: true }))

async function settle(page: import('@playwright/test').Page) {
  await page.getByTestId('score').waitFor()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

test.describe('@screenshots', () => {
  test('desktop dashboard, ledger, Arabic and upload', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop-chrome', 'desktop only')

    await page.setViewportSize({ width: 1280, height: 900 })
    await open(page, '/score/nusrat', 'en')
    await settle(page)
    await page.screenshot({ path: `${OUT}/dashboard-desktop.png` })

    await page.locator('section[aria-labelledby]:has(table)').first().screenshot({ path: `${OUT}/ledger.png` })

    await page.setViewportSize({ width: 1100, height: 800 })
    await open(page, '/score/nusrat', 'ar' as Locale)
    await page.evaluate(() => localStorage.setItem('arthik.locale', 'ar'))
    await page.reload()
    await settle(page)
    await page.screenshot({ path: `${OUT}/arabic-rtl.png` })

    await page.setViewportSize({ width: 1100, height: 800 })
    await page.evaluate(() => localStorage.setItem('arthik.locale', 'en'))
    await page.goto('./#/upload')
    await page.reload()
    await page.locator('input[type="file"]').waitFor({ state: 'attached' })
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    await page.screenshot({ path: `${OUT}/upload.png` })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.evaluate(() => localStorage.setItem('arthik.theme', 'dark'))
    await page.goto('./#/score/nusrat')
    await page.reload()
    await settle(page)
    await page.screenshot({ path: `${OUT}/dashboard-dark.png` })
  })

  test('mobile dashboard in Bengali', async ({ page }, info) => {
    test.skip(info.project.name !== 'android', 'android only')
    await open(page, '/score/nusrat', 'bn')
    await settle(page)
    await page.screenshot({ path: `${OUT}/dashboard-mobile-bn.png` })
  })
})
