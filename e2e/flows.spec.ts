import { asNumber, expect, SAMPLE_RANGES, test, uploadFile } from './fixtures'

test.describe('the five sample people', () => {
  for (const [person, [low, high]] of Object.entries(SAMPLE_RANGES)) {
    test(`${person} loads and scores between ${low} and ${high}`, async ({ page }) => {
      await page.goto(`./#/score/${person}`)

      const score = page.getByTestId('score')
      await expect(score).toBeVisible()
      const value = asNumber(await score.textContent())
      expect(value).toBeGreaterThanOrEqual(low)
      expect(value).toBeLessThanOrEqual(high)
      await expect(page).toHaveTitle(/· Arthik$/)
    })
  }
})

test('the home page loads and names itself', async ({ page }) => {
  await page.goto('./')

  await expect(page).toHaveTitle('Home · Arthik')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('the template file shows a score from three complete months', async ({ page }) => {
  await uploadFile(page, 'public/arthik-template.csv')

  await expect(page).toHaveURL(/#\/score\/mine$/)
  await expect(page.getByTestId('score')).toBeVisible()
  await expect(page.getByText('Using 3 complete months')).toBeVisible()
})

test('a malformed file lists its errors by row', async ({ page }) => {
  const header = 'date,description,amount,currency,category\n'
  const rows = '2026-08-01,Salary,55000,BDT,\nnot-a-date,Rent,-18000,BDT,\n2026-08-03,Shop,abc,BDT,\n'
  await uploadFile(page, {
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(header + rows),
  })

  await expect(page).toHaveURL(/#\/upload$/)
  await expect(page.getByText(/couldn’t read/).first()).toBeVisible()
  await expect(page.getByText('Row 3:')).toBeVisible()
  await expect(page.getByText('Row 4:')).toBeVisible()
})

test('the wants slider, moved by keyboard, changes the result', async ({ page }) => {
  await page.goto('./#/score/tanvir')
  const wants = page.getByRole('slider').first()
  const from = page.getByTestId('whatif-from')
  const to = page.getByTestId('whatif-to')
  const start = (await from.textContent()) ?? ''
  await expect(to).toHaveText(start)

  await wants.focus()
  await wants.press('End')

  await expect(wants).toHaveValue('50')
  await expect(to).not.toHaveText(start)
})

test('changing a category changes the ledger', async ({ page }) => {
  await page.goto('./#/score/nusrat')
  const ledger = page.locator('table').filter({ hasText: /Savings rate/ }).first()
  const before = await ledger.innerText()
  const score = await page.getByTestId('score').textContent()

  await page
    .getByRole('combobox', { name: /Nagad Received 01911xxxxxx - Tuition/ })
    .first()
    .selectOption('own_transfer')

  await expect.poll(() => ledger.innerText()).not.toBe(before)
  expect(await page.getByTestId('score').textContent()).not.toBe(score)
})
