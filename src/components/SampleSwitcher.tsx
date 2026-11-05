import { useId } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, NavLink } from 'react-router'
import { PERSON_IDS } from '../data/samples/people'
import styles from './SampleSwitcher.module.css'

/** The bar under the header on score pages: move between the five people, or use your own file. */
export function SampleSwitcher() {
  const labelId = useId()

  return (
    <div className={styles.bar}>
      <nav className={`wrap ${styles.inner}`} aria-labelledby={labelId}>
        <span className={styles.label} id={labelId}>
          <FormattedMessage id="samples.label" />
        </span>
        <ul className={styles.people}>
          {PERSON_IDS.map((id) => (
            <li key={id}>
              <NavLink to={`/score/${id}`} className={styles.person}>
                <FormattedMessage id={`person.${id}.name`} />
              </NavLink>
            </li>
          ))}
        </ul>
        <Link to="/upload" className={styles.own}>
          <FormattedMessage id="samples.useOwn" />
        </Link>
      </nav>
    </div>
  )
}
