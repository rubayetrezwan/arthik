import { expect, test } from './fixtures'

test('the manifest is linked and a service worker registers', async ({ page, request }) => {
  await page.goto('./')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(new URL(href!, page.url()).toString())).json()
  expect(manifest).toMatchObject({
    name: 'Arthik',
    short_name: 'Arthik',
    start_url: '/arthik/',
    scope: '/arthik/',
    display: 'standalone',
    background_color: '#F4EFE4',
    theme_color: '#F4EFE4',
  })
  const sizes = manifest.icons.map((icon: { sizes: string; purpose?: string }) => `${icon.sizes}${icon.purpose ? ` ${icon.purpose}` : ''}`)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512 maskable']))
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F4EFE4')

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(scope).toMatch(/\/arthik\/$/)
})

test('after one visit, the home page and a sample score load with no network', async ({
  page,
  context,
}) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  // Wait until the worker controls the page, which is when it can answer requests.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  const failed: string[] = []
  page.on('requestfailed', (request) => failed.push(request.url()))
  await context.setOffline(true)

  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveTitle('Home · Arthik')

  await page.goto('./#/score/nusrat')
  await page.reload()
  await expect(page.getByTestId('score')).toBeVisible()

  // A person not visited before still loads: their data is part of the cached app.
  await page.goto('./#/score/rahim')
  await page.reload()
  await expect(page.getByTestId('score')).toBeVisible()

  // So does a language not used before.
  await page.locator('select:has(option[value="bn"])').selectOption('bn')
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn-BD')
  await expect(page.getByTestId('score')).toBeVisible()
  expect(failed).toEqual([])
})

test('nothing the visitor brings is kept in a cache', async ({ page }) => {
  await page.goto('./')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
  await page.goto('./#/upload')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'mine.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      [
        'date,description,amount,currency,category',
        ...['08', '09', '10'].flatMap((month) => [
          `2026-${month}-01,Secret salary,55000,BDT,`,
          `2026-${month}-02,Rent,-18000,BDT,`,
        ]),
      ].join('\n'),
    ),
  })
  await page.locator('form button[type="submit"]').click()
  await page.getByTestId('score').waitFor()

  const cached = await page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) urls.push(request.url)
    }
    return urls
  })
  expect(cached.length).toBeGreaterThan(0)
  expect(cached.filter((url) => /mine\.csv|secret/i.test(url))).toEqual([])
  expect(cached.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true)
})
