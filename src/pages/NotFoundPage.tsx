import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { PageHead } from '../components/PageHead'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <PageHead title={<FormattedMessage id="notFound.title" />}>
      <p>
        <FormattedMessage id="notFound.text" />
      </p>
      <Link to="/" className={styles.home}>
        <FormattedMessage id="notFound.home" />
      </Link>
    </PageHead>
  )
}
