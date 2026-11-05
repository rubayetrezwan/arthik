import { useId, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { Link } from 'react-router'
import { SOURCE_CODE_URL } from '../components/Footer'
import { PageHead } from '../components/PageHead'
import styles from './AboutPage.module.css'
import { useHabitsFigures } from './useHabitsFigures'

/** A ruled section named by its h2. */
function AboutSection({ titleId, children }: { titleId: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.heading}>
        <FormattedMessage id={titleId} />
      </h2>
      {children}
    </section>
  )
}

/** Who made Arthik and why, where AI was and wasn't used, what it is not, and its source. */
export function AboutPage() {
  const intl = useIntl()
  const figures = useHabitsFigures()
  const person = (id: 'nusrat' | 'farhana' | 'rahim') =>
    intl.formatMessage({ id: `person.${id}.name` })

  return (
    <>
      <PageHead title={<FormattedMessage id="about.title" />}>
        <p>
          <FormattedMessage id="about.lead" />
        </p>
      </PageHead>

      <AboutSection titleId="about.why.title">
        <div className={styles.prose}>
          <p>
            <FormattedMessage id="about.why.who" />
          </p>
          <p>
            <FormattedMessage id="about.why.inclusion" />
          </p>
          <p>
            <FormattedMessage
              id="about.why.habits"
              values={{
                farhana: person('farhana'),
                nusrat: person('nusrat'),
                rahim: person('rahim'),
                ...figures,
              }}
            />
          </p>
        </div>
      </AboutSection>

      <AboutSection titleId="about.who.title">
        <p className={styles.prose}>
          <FormattedMessage id="about.who.text" />
        </p>
        <ul className={styles.list}>
          <li>
            {/* A paragraph, so the link reads as part of the sentence it sits in. */}
            <p>
              <FormattedMessage
                id="about.ai.score"
                values={{ link: (chunks) => <Link to="/how-it-works">{chunks}</Link> }}
              />
            </p>
          </li>
          <li>
            <FormattedMessage id="about.ai.summaries" />
          </li>
          <li>
            <FormattedMessage id="about.ai.translations" />
          </li>
        </ul>
      </AboutSection>

      <AboutSection titleId="about.not.title">
        <p className={styles.prose}>
          <FormattedMessage id="disclaimer" />
        </p>
      </AboutSection>

      <AboutSection titleId="about.source.title">
        <p className={styles.prose}>
          <FormattedMessage id="about.source.text" />
        </p>
        <a href={SOURCE_CODE_URL} className={styles.source}>
          {SOURCE_CODE_URL.replace(/^https:\/\//, '')}
        </a>
      </AboutSection>
    </>
  )
}
