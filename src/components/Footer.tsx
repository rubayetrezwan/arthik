import { FormattedMessage } from 'react-intl'
import { RATES } from '../domain/currency'
import { formatFullDate } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { Disclaimer } from './Disclaimer'
import styles from './Footer.module.css'

const SOURCE_CODE_URL = 'https://github.com/rubayetrezwan/arthik'

export function Footer() {
  const locale = useLocale()

  return (
    <footer className={styles.footer}>
      <div className="wrap">
        <Disclaimer />
        <div className={styles.lines}>
          {/* The rate source asks to be credited with a link. */}
          <p className={styles.rates}>
            <FormattedMessage
              id="footer.rates"
              values={{
                date: <time dateTime={RATES.date}>{formatFullDate(RATES.date, locale)}</time>,
                source: <a href={RATES.sourceUrl}>{RATES.source}</a>,
              }}
            />
          </p>
          <ul className={styles.credits}>
            <li>
              <FormattedMessage id="footer.madeBy" />
            </li>
            <li>
              <FormattedMessage id="footer.builtWith" />
            </li>
            <li>
              <a href={SOURCE_CODE_URL}>
                <FormattedMessage id="footer.sourceCode" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
