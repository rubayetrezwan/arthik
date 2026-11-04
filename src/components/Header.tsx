import { FormattedMessage, useIntl } from 'react-intl'
import { Link, NavLink, useMatch } from 'react-router'
import { PERSON_IDS } from '../data/samples'
import { useSession } from '../state/session'
import { CurrencySelect } from './CurrencySelect'
import styles from './Header.module.css'
import { LanguageSelect } from './LanguageSelect'

/** Where "Your score" leads: the visitor's own file, else the last person they looked at. */
function useScorePath(): string {
  const { upload, activeKey } = useSession()
  const key = upload ? 'mine' : (activeKey ?? PERSON_IDS[0])
  return `/score/${key}`
}

export function Header() {
  const intl = useIntl()
  const scorePath = useScorePath()
  // "Your score" covers every score page: the copy speaks to the visitor even for samples.
  const onScorePage = useMatch('/score/*') !== null

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
            to={scorePath}
            className={styles.link}
            aria-current={onScorePage ? 'page' : undefined}
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
