import { FormattedMessage } from 'react-intl'
import styles from './Disclaimer.module.css'

/** What Arthik is not (spec 2, anti-goals): shown at the foot of every page. */
export function Disclaimer() {
  return (
    <p className={styles.disclaimer}>
      <FormattedMessage id="disclaimer" />
    </p>
  )
}
