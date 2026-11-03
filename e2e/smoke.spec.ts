import { expect, test } from '@playwright/test'

test('the page loads with the right title and no console errors', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(error.message))

  await page.goto('./')

  await expect(page).toHaveTitle('Arthik')
  expect(problems).toEqual([])
})
