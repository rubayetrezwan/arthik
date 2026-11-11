import { Outlet, ScrollRestoration } from 'react-router'
import { useRouteDatasetKey } from '../state/session'
import styles from './AppLayout.module.css'
import { DocumentTitle } from './DocumentTitle'
import { Footer } from './Footer'
import { Header } from './Header'
import { SampleSwitcher } from './SampleSwitcher'
import { SkipLink } from './SkipLink'
import { useFocusOnPageChange } from './useFocusOnPageChange'

/** The frame around every page. */
export function AppLayout() {
  const onScorePage = useRouteDatasetKey() !== null
  useFocusOnPageChange()

  return (
    <>
      <DocumentTitle />
      <SkipLink />
      <Header />
      {onScorePage && <SampleSwitcher />}
      {/* Focusable so the skip link can move focus here. */}
      <main id="main" tabIndex={-1} className={`wrap ${styles.main}`}>
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </>
  )
}
