import { FormattedMessage, useIntl } from 'react-intl'
import { Link, NavLink } from 'react-router'
import type { PersonId } from '../domain/types'
import { useRouteDatasetKey, useSession, type DatasetKey } from '../state/session'
import { CurrencySelect } from './CurrencySelect'
import styles from './Header.module.css'
import { LanguageSelect } from './LanguageSelect'

/** Where "Your score" leads a visitor who has not looked at anyone yet: the first sample. */
const FIRST_PERSON: PersonId = 'nusrat'

/**
 * Where "Your score" leads: the visitor's own file once there is one, else the person on
 * screen or looked at last. The copy speaks to the visitor even for samples.
 */
function useScoreKey(shown: DatasetKey | null): DatasetKey {
  const { upload, activeKey } = useSession()
  if (upload) return 'mine'
  return shown ?? activeKey ?? FIRST_PERSON
}

export function Header() {
  const intl = useIntl()
  const shown = useRouteDatasetKey()
  const scoreKey = useScoreKey(shown)

  return (
    <header className={styles.header}>
      <div className={`wrap ${styles.bar}`}>
        {/* The wordmark is the logo, so it reads the same in every language. */}
        <Link to="/" className={styles.wordmark}>
          <span className={styles.lockup}>
            <span lang="en">Arthik</span>{' '}
            <span className={styles.bengali} lang="bn">
              আর্থিক
            </span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label={intl.formatMessage({ id: 'nav.label' })}>
          <Link
            to={`/score/${scoreKey}`}
            className={styles.link}
            aria-current={shown === scoreKey ? 'page' : undefined}
          >
            <FormattedMessage id="nav.score" />
          </Link>
          <NavLink to="/how-it-works" className={styles.link}>
            <FormattedMessage id="nav.howItWorks" />
          </NavLink>
          <NavLink to="/about" className={styles.link}>
            <FormattedMessage id="nav.about" />
          </NavLink>
        </nav>

        <div className={styles.prefs}>
          <LanguageSelect />
          <CurrencySelect />
        </div>
      </div>
    </header>
  )
}
