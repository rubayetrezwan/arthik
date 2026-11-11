// Sets the colour theme before the page first paints, so a visitor who chose dark never sees
// a flash of light paper. It is a file, not an inline script, because the page's security
// policy allows scripts from this site only. React keeps the theme in step from then on
// (src/state/theme.ts): the key and the two colours here must match the ones there.
;(function () {
  var choice = null
  try {
    choice = window.localStorage.getItem('arthik.theme')
  } catch {
    // Storage blocked: follow the device.
  }
  var dark =
    choice === 'dark' ||
    (choice !== 'light' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  var theme = dark ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)
  var bar = document.querySelector('meta[name="theme-color"]')
  if (bar) bar.setAttribute('content', dark ? '#191612' : '#F4EFE4')
})()
