import type { MouseEvent } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './SkipLink.module.css'

/**
 * Lets keyboard users jump past the header. The page uses a hash router, so following
 * "#main" would look for a route called "main": the link moves focus itself instead.
 */
export function SkipLink() {
  function skip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    document.getElementById('main')?.focus()
  }

  return (
    <a className={styles.skip} href="#main" onClick={skip}>
      <FormattedMessage id="skipLink" />
    </a>
  )
}
