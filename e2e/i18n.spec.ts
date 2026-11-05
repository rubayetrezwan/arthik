import {
  asNumber,
  currencySelect,
  DIRECTION,
  expect,
  HTML_LANG,
  languageSelect,
  LOCALES,
  test,
  uploadFile,
} from './fixtures'

for (const locale of LOCALES) {
  test(`${locale}: lang and dir are set, the nav is translated, and the choice survives a reload`, async ({
    page,
  }) => {
    await page.goto('./')
    const nav = page.getByRole('navigation').first()
    const english = await nav.innerText()

    await languageSelect(page).selectOption(locale)
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale])
    await expect(page.locator('html')).toHaveAttribute('dir', DIRECTION[locale])
    if (locale === 'en') expect(await nav.innerText()).toBe(english)
    else await expect.poll(() => nav.innerText()).not.toBe(english)
    const translated = await nav.innerText()

    await page.reload()
    await page.locator('main').waitFor()
    await expect(page.locator('html')).toHaveAttribute('lang', HTML_LANG[locale])
    await expect(page.locator('html')).toHaveAttribute('dir', DIRECTION[locale])
    await expect(languageSelect(page)).toHaveValue(locale)
    expect(await page.getByRole('navigation').first().innerText()).toBe(translated)
  })
}

test('Review Focus 5: switching to Bengali, then USD, keeps the score and changes the symbol', async ({
  page,
}) => {
  await uploadFile(page, 'public/arthik-template.csv')
  const score = page.getByTestId('score')
  await expect(score).toBeVisible()
  const value = asNumber(await score.textContent())
  // The money slider shows the display currency. (The transactions list keeps each amount as
  // it was in the file, with the converted amount beside it.)
  const extraIncome = page.getByRole('slider').nth(1)
  await expect(extraIncome).toHaveAttribute('aria-valuetext', /৳/)

  await languageSelect(page).selectOption('bn')
  await expect(page.locator('html')).toHaveAttribute('lang', 'bn-BD')
  expect(asNumber(await score.textContent())).toBe(value)

  await currencySelect(page).selectOption('USD')
  await expect(extraIncome).toHaveAttribute('aria-valuetext', /\$/)
  await expect(extraIncome).not.toHaveAttribute('aria-valuetext', /৳/)
  expect(asNumber(await score.textContent())).toBe(value)
  await expect(page).toHaveURL(/#\/score\/mine$/)
})
