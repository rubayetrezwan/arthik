import { useId, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link } from 'react-router'
import { HIGHEST_SCORE, type Band } from '../domain/score'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { BandScale } from './BandScale'
import styles from './ScoreCard.module.css'

interface ScoreCardProps {
  score: number
  band: Band
  /** A sample person's written summary. It is shown with a note on who wrote it. */
  summary?: ReactNode
  /** The sample's categories were changed, so its summary no longer fits and is held back. */
  summaryHidden?: boolean
}

/** The score itself: the figure, its band as a stamp, the band scale and, for samples, the summary. */
export function ScoreCard({ score, band, summary, summaryHidden = false }: ScoreCardProps) {
  const locale = useLocale()
  const titleId = useId()

  return (
    <section className={styles.sheet} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id="score.sheet" />
      </h2>

      <p className={styles.figure}>
        {/* A final total, so it gets the accounting double underline. */}
        <span className={styles.score} data-testid="score">
          {formatNumber(score, locale)}
        </span>
        <span className={styles.outOf}>
          <FormattedMessage id="score.outOf" values={{ max: formatNumber(HIGHEST_SCORE, locale) }} />
        </span>
      </p>

      <p className={styles.band}>
        <span className={`${styles.stamp} ${styles[band]}`}>
          <FormattedMessage id={`band.${band}`} />
        </span>{' '}
        <FormattedMessage id={`band.${band}.explain`} />
      </p>

      <BandScale score={score} />

      {summary && (
        <div className={styles.summary}>
          <p className={styles.summaryText} data-summary>
            {summary}
          </p>
          <p className={styles.note}>
            <FormattedMessage
              id="sample.note"
              values={{ link: (text: ReactNode) => <Link to="/how-it-works">{text}</Link> }}
            />
          </p>
        </div>
      )}
      {summaryHidden && (
        <p className={styles.changed}>
          <FormattedMessage id="sample.changed" />
        </p>
      )}
    </section>
  )
}
