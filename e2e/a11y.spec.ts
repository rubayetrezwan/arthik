import AxeBuilder from '@axe-core/playwright'
import { expect, open, test, uploadFile, type Locale } from './fixtures'

const ROUTES = ['/', '/score/nusrat', '/score/mine', '/upload', '/how-it-works', '/about', '/nowhere']

for (const locale of ['en', 'ar'] as Locale[]) {
  for (const route of ROUTES) {
    test(`${locale} ${route}: no serious or critical accessibility violations`, async ({ page }) => {
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
    })
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
