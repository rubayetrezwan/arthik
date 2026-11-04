import { Outlet, ScrollRestoration, useMatch } from 'react-router'
import { isDatasetKey } from '../state/session'
import styles from './AppLayout.module.css'
import { Footer } from './Footer'
import { Header } from './Header'
import { SampleSwitcher } from './SampleSwitcher'
import { SkipLink } from './SkipLink'

/** The frame around every page. */
export function AppLayout() {
  const person = useMatch('/score/:person')?.params.person
  const onScorePage = person !== undefined && isDatasetKey(person)

  return (
    <>
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
