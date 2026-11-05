import { FormattedMessage } from 'react-intl'
import { BAND_RANGES } from '../../domain/score'
import { formatNumber } from '../../i18n/format'
import { useLocale } from '../../i18n/I18nProvider'
import styles from './Method.module.css'
import { MethodSection } from './MethodSection'

/** The three bands, drawn from BAND_RANGES, each with what it means. */
export function BandsSection() {
  const locale = useLocale()

  return (
    <MethodSection titleId="howItWorks.bands.title">
      {(headingId) => (
        <div className={styles.pair}>
          <p className={styles.prose}>
            <FormattedMessage id="howItWorks.bands.intro" />
          </p>
          <table className={styles.table} aria-labelledby={headingId}>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="howItWorks.bands.band" />
                </th>
                <th scope="col" className={styles.end}>
                  <FormattedMessage id="howItWorks.bands.scores" />
                </th>
              </tr>
            </thead>
            <tbody>
              {BAND_RANGES.map(({ band, min, max }) => (
                <tr key={band}>
                  <th scope="row">
                    <span className={`${styles.band} ${styles[band]}`}>
                      <FormattedMessage id={`band.${band}`} />
                    </span>
                    <span className={styles.detail}>
                      <FormattedMessage id={`band.${band}.explain`} />
                    </span>
                  </th>
                  <td className={`${styles.end} ${styles.figure}`}>
                    <FormattedMessage
                      id="band.range"
                      values={{ min: formatNumber(min, locale), max: formatNumber(max, locale) }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MethodSection>
  )
}
