import { FormattedMessage, useIntl } from 'react-intl'
import { BAND_RANGES } from '../domain/score'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import styles from './BandScale.module.css'

/**
 * The three bands from 0 to 100, with a marker at the score. The bar is a picture of the
 * figure and band already written above it, so it is hidden from screen readers; the band
 * names and their ranges below it are text.
 */
export function BandScale({ score }: { score: number }) {
  const intl = useIntl()
  const locale = useLocale()

  return (
    <div className={styles.scale}>
      <div className={styles.track} aria-hidden="true">
        <span className={styles.vulnerable} />
        <span className={styles.coping} />
        <span className={styles.healthy} />
        {/* Logical inset, so in Arabic the scale runs from the right like the text. */}
        <span
          className={styles.marker}
          data-testid="band-marker"
          style={{ insetInlineStart: `calc(${score}% - 1.5px)` }}
        />
      </div>
      <ul className={styles.names} aria-label={intl.formatMessage({ id: 'band.scale' })}>
        {BAND_RANGES.map(({ band, min, max }) => (
          <li key={band}>
            <span className={styles.name}>
              <FormattedMessage id={`band.${band}`} />
            </span>
            <span className={styles.range}>
              <FormattedMessage
                id="band.range"
                values={{ min: formatNumber(min, locale), max: formatNumber(max, locale) }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
