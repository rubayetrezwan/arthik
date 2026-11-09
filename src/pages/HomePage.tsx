import { useId } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { PageHead } from '../components/PageHead'
import { PERSON_IDS, SAMPLE_SCORES } from '../data/samples/people'
import { LOWEST_SCORE } from '../domain/anchors'
import { bandOf, HIGHEST_SCORE, MEASURE_IDS, WEIGHTS } from '../domain/score'
import { formatNumber, formatWeight } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import styles from './HomePage.module.css'
import { useHabitsFigures } from './useHabitsFigures'

/** The opening page: what Arthik is, the five sample people, and the visitor's own file. */
export function HomePage() {
  const intl = useIntl()
  const locale = useLocale()
  const samplesId = useId()
  const ownId = useId()
  const methodId = useId()
  const figures = useHabitsFigures()

  // WEIGHTS are whole percents; formatWeight takes tenths of a percent.
  const totalWeight = MEASURE_IDS.reduce((sum, id) => sum + WEIGHTS[id], 0)
  const weight = (percent: number) => formatWeight(percent * 10, locale)

  return (
    <>
      <PageHead title={<FormattedMessage id="home.title" />}>
        <p className={styles.pitch}>
          <FormattedMessage
            id="home.pitch"
            values={{
              lowest: formatNumber(LOWEST_SCORE, locale),
              highest: formatNumber(HIGHEST_SCORE, locale),
            }}
          />
        </p>
        <p className={styles.free}>
          <FormattedMessage id="home.pitch.free" />
        </p>
      </PageHead>

      <div className={styles.columns}>
        <section aria-labelledby={samplesId}>
          <h2 id={samplesId} className={styles.heading}>
            <FormattedMessage id="samples.label" />
          </h2>
          <p className={styles.note}>
            <FormattedMessage
              id="home.samples.note"
              values={{
                farhana: intl.formatMessage({ id: 'person.farhana.name' }),
                nusrat: intl.formatMessage({ id: 'person.nusrat.name' }),
                incomeMultiple: figures.incomeMultiple,
              }}
            />
          </p>
          <ol className={styles.people}>
            {PERSON_IDS.map((id, index) => (
              <li key={id}>
                <Link to={`/score/${id}`} className={styles.person}>
                  <span className={styles.numeral} aria-hidden="true">
                    {formatNumber(index + 1, locale)}
                  </span>
                  <span>
                    <FormattedMessage
                      id="home.samples.entry"
                      values={{
                        name: (
                          <span className={styles.name}>
                            {intl.formatMessage({ id: `person.${id}.name` })}
                          </span>
                        ),
                        role: intl.formatMessage({ id: `person.${id}.role` }),
                      }}
                    />
                  </span>
                  <span className={styles.result}>
                    <span className={styles.points}>{formatNumber(SAMPLE_SCORES[id], locale)}</span>
                    <span className={styles.bandWord}>
                      <FormattedMessage id={`band.${bandOf(SAMPLE_SCORES[id])}`} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby={ownId} className={styles.own}>
          <h2 id={ownId} className={styles.heading}>
            <FormattedMessage id="home.own.title" />
          </h2>
          <p className={styles.text}>
            <FormattedMessage id="home.own.text" />
          </p>
          <Link to="/upload" className={styles.action}>
            <FormattedMessage id="samples.useOwn" />
          </Link>
          <p className={styles.privacy}>
            <strong>
              <FormattedMessage id="home.privacy.lead" />
            </strong>{' '}
            <FormattedMessage id="home.privacy.text" />
          </p>
        </section>
      </div>

      <section aria-labelledby={methodId} className={styles.method}>
        <h2 id={methodId} className={styles.heading}>
          <FormattedMessage id="home.method.title" />
        </h2>
        <p className={styles.note}>
          <FormattedMessage
            id="home.method.note"
            values={{ highest: formatNumber(HIGHEST_SCORE, locale) }}
          />
        </p>

        <div className={styles.methodBody}>
          <table className={styles.weights}>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="home.method.measure" />
                </th>
                <th scope="col" className={styles.end}>
                  <FormattedMessage id="home.method.weight" />
                </th>
              </tr>
            </thead>
            <tbody>
              {MEASURE_IDS.map((id) => (
                <tr key={id}>
                  <th scope="row">
                    <span className={styles.measure}>
                      <FormattedMessage id={`measure.${id}.name`} />
                    </span>
                    <span className={styles.question}>
                      <FormattedMessage id={`measure.${id}.question`} />
                    </span>
                  </th>
                  <td className={`${styles.end} ${styles.weight}`}>{weight(WEIGHTS[id])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">
                  <FormattedMessage id="home.method.total" />
                </th>
                <td className={styles.end}>
                  <span className={styles.total}>{weight(totalWeight)}</span>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className={styles.formulas}>
            <p>
              <FormattedMessage id="home.method.formulas" />
            </p>
            <Link to="/how-it-works" className={styles.more}>
              <FormattedMessage id="nav.howItWorks" />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
