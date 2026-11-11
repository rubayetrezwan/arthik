import { useEffect } from 'react'
import { useIntl } from 'react-intl'
import { useLocation } from 'react-router'
import { isDatasetKey } from '../state/session'

/** The id of the message that names the page at `pathname`. */
export function pageKey(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return 'nav.home'
  if (path === '/upload') return 'upload.title'
  if (path === '/how-it-works') return 'nav.howItWorks'
  if (path === '/about') return 'nav.about'
  const person = /^\/score\/([^/]+)$/.exec(path)?.[1]
  if (person !== undefined && isDatasetKey(person)) {
    return person === 'mine' ? 'score.title' : `person.${person}.name`
  }
  return 'notFound.title'
}

/**
 * Keeps the browser tab's title in step with the page, in the language on screen
 * (WCAG 2.4.2): "Home · Arthik", "Score for Nusrat · Arthik".
 */
export function DocumentTitle() {
  const intl = useIntl()
  const { pathname } = useLocation()

  const key = pageKey(pathname)
  const named = key.startsWith('person.')
  const page = named
    ? intl.formatMessage({ id: 'shell.title.sample' }, { name: intl.formatMessage({ id: key }) })
    : intl.formatMessage({ id: key })
  const app = intl.formatMessage({ id: 'app.name' })
  const title = intl.formatMessage({ id: 'shell.title.pattern' }, { page, app })

  useEffect(() => {
    document.title = title
  }, [title])

  return null
}
