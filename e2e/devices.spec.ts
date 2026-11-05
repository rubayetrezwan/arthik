import type { Page } from '@playwright/test'
import { expect, LOCALES, open, test, uploadFile, type Locale } from './fixtures'

const WIDTHS = [320, 375, 768, 1024, 1280, 1920]
const DEVICE_LOCALES: Locale[] = ['en', 'bn', 'ar']
const ROUTES = ['/', '/score/nusrat', '/score/mine', '/upload', '/how-it-works', '/about']

/** Puts a file of the visitor's own in the session, so /score/mine has a score to show. */
async function withOwnFile(page: Page, locale: Locale) {
  await open(page, '/upload', locale)
  await page.locator('input[type="file"]').setInputFiles('public/arthik-template.csv')
  await page.locator('form button[type="submit"]').click()
  await page.getByTestId('score').waitFor()
}

async function goTo(page: Page, route: string, locale: Locale) {
  if (route === '/score/mine') {
    await withOwnFile(page, locale)
  } else {
    await open(page, route, locale)
    if (route.startsWith('/score/')) await page.getByTestId('score').waitFor()
  }
  // Fonts settle the layout: wait for them before measuring.
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

const overflow = (page: Page) =>
  page.evaluate(() => {
    const root = document.documentElement
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  })

for (const locale of DEVICE_LOCALES) {
  for (const route of ROUTES) {
    test(`${locale} ${route}: no horizontal scroll at any width`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 })
      await goTo(page, route, locale)

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        const { scrollWidth, clientWidth } = await overflow(page)
        expect(scrollWidth, `${locale} ${route} at ${width}px`).toBeLessThanOrEqual(clientWidth)
      }
    })

    test(`${locale} ${route}: every control is at least 44px tall at 375px`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 })
      await goTo(page, route, locale)

      const small = await page.evaluate(() => {
        const controls = document.querySelectorAll(
          'a[href], button, input, select, textarea, summary, [role="button"], [role="slider"], [tabindex="0"]',
        )
        const found: string[] = []
        for (const el of controls) {
          const box = el.getBoundingClientRect()
          // Not on screen at all: the skip link before it is focused, a visually hidden input.
          if (box.width <= 1 || box.height <= 1) continue
          const style = getComputedStyle(el)
          if (style.visibility === 'hidden' || style.display === 'none') continue
          // A link inside a sentence takes the height of its line (WCAG 2.5.8 exempts these).
          if (el.tagName === 'A' && el.closest('p, dd, li > span')) continue
          // A form control already inside a larger labelled box counts through the box.
          if (box.height < 44) {
            const label = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)
            found.push(`${el.tagName.toLowerCase()} "${label}" is ${Math.round(box.height)}px`)
          }
        }
        return found
      })

      expect(small).toEqual([])
    })
  }
}

// The ledger's column headings never wrap, so a long heading in any language could push the
// page wider than the screen at the narrowest width where the ledger sits beside the score.
for (const locale of LOCALES) {
  test(`${locale}: the ledger's column headings fit at 1024px`, async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 })
    await open(page, '/score/nusrat', locale)
    await page.getByTestId('score').waitFor()
    await page.evaluate(() => document.fonts.ready.then(() => undefined))

    const { scrollWidth, clientWidth } = await overflow(page)
    expect(scrollWidth, `${locale} at 1024px`).toBeLessThanOrEqual(clientWidth)

    // The headings are inside their table, not spilling out of it.
    const spill = await page.evaluate(() => {
      const table = [...document.querySelectorAll('table')].find((t) => t.querySelector('thead'))
      if (!table) return ['no ledger table']
      const edge = table.getBoundingClientRect()
      return [...table.querySelectorAll('thead th')]
        .filter((th) => {
          const box = th.getBoundingClientRect()
          return box.left < edge.left - 1 || box.right > edge.right + 1
        })
        .map((th) => th.textContent ?? '')
    })
    expect(spill).toEqual([])
  })
}

// Stacking a table into rows on a phone must not take its meaning away from a screen reader.
test.describe('table meaning at 375px', () => {
  test('the stacked ledger and the stacked How it works tables keep rows, headings and cells', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 })

    for (const route of ['/score/nusrat', '/how-it-works']) {
      await open(page, route)
      if (route.startsWith('/score/')) await page.getByTestId('score').waitFor()

      const tables = page.locator('table')
      const count = await tables.count()
      expect(count).toBeGreaterThan(0)
      for (let i = 0; i < count; i += 1) {
        const snapshot = await tables.nth(i).ariaSnapshot()
        expect(snapshot, `${route} table ${i + 1}`).toMatch(/- table/)
        expect(snapshot, `${route} table ${i + 1}`).toMatch(/- row/)
        expect(snapshot, `${route} table ${i + 1}`).toMatch(/- (cell|rowheader|columnheader)/)
        // Every stacked table has column headings; they stay in the accessibility tree.
        if ((await tables.nth(i).locator('thead').count()) > 0) {
          expect(snapshot, `${route} table ${i + 1}`).toMatch(/- columnheader/)
        }
      }
    }
  })

  test('the ledger can still be uploaded and read at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await uploadFile(page, 'public/arthik-template.csv')
    await expect(page.getByTestId('score')).toBeVisible()
  })
})
