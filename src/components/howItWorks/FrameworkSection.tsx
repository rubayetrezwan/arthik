import { FormattedMessage } from 'react-intl'
import { useLocale } from '../../i18n/I18nProvider'
import { LOCALES, type LocaleCode } from '../../i18n/locales'
import styles from './Method.module.css'
import { MethodSection } from './MethodSection'

/**
 * The works the score draws on, as cited in spec 5.1. Titles of published works keep their
 * own wording in every language. A citation only: nothing is linked or fetched.
 */
const REFERENCE = {
  org: 'Financial Health Network',
  toolkit: 'FinHealth Score Toolkit',
  toolkitYear: 2021,
  article: 'Eight Ways to Measure Financial Health',
}

/** A year in the language's own digits, without the grouping a plain number would get. */
function formatYear(year: number, locale: LocaleCode): string {
  return new Intl.NumberFormat(LOCALES[locale].intl, { useGrouping: false }).format(year)
}

/** Where the method comes from: the FinHealth Score, and what Arthik can and can't measure of it. */
export function FrameworkSection() {
  const locale = useLocale()

  return (
    <MethodSection titleId="howItWorks.framework.title">
      <div className={styles.prose}>
        <p className={styles.intro}>
          <FormattedMessage id="howItWorks.framework.inspired" />
        </p>
        <p>
          <FormattedMessage id="howItWorks.framework.measured" />
        </p>
      </div>
      <p className={styles.citation}>
        <FormattedMessage
          id="howItWorks.framework.reference"
          values={{
            org: REFERENCE.org,
            toolkit: <cite>{REFERENCE.toolkit}</cite>,
            year: formatYear(REFERENCE.toolkitYear, locale),
            article: REFERENCE.article,
          }}
        />
      </p>
    </MethodSection>
  )
}
