import { useId, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './GetYourFile.module.css'

const bold = (chunks: ReactNode) => <b>{chunks}</b>

/** Where a CSV file comes from, for a bank and for the mobile wallets that only give PDFs (R57). */
export function GetYourFile() {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className={styles.where}>
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id="upload.where.title" />
      </h2>
      <ul className={styles.list}>
        <li>
          <FormattedMessage id="upload.where.bank" values={{ b: bold }} />
        </li>
        <li>
          <FormattedMessage id="upload.where.wallet" values={{ b: bold }} />
        </li>
      </ul>
    </section>
  )
}
