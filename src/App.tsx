import { useState } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'
import { I18nProvider, type PreloadedLanguage } from './i18n/I18nProvider'
import { routes } from './routes'
import { PrefsProvider } from './state/prefs'
import { SessionProvider } from './state/session'

// The session sits above the language and the router, so changing the language or
// reading another page never loses the visitor's file or their category changes.
export default function App({ language }: { language?: PreloadedLanguage }) {
  // A hash router: GitHub Pages serves one file and knows nothing of the app's routes.
  const [router] = useState(() => createHashRouter(routes))

  return (
    <PrefsProvider>
      <SessionProvider>
        <I18nProvider initial={language}>
          <RouterProvider router={router} />
        </I18nProvider>
      </SessionProvider>
    </PrefsProvider>
  )
}
