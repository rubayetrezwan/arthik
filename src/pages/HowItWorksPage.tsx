import { useEffect, useId } from 'react'
import { FormattedMessage } from 'react-intl'
import { Link, useLocation } from 'react-router'
import { BandsSection } from '../components/howItWorks/BandsSection'
import { CategoriesSection } from '../components/howItWorks/CategoriesSection'
import { FrameworkSection } from '../components/howItWorks/FrameworkSection'
import { MeasuresSection } from '../components/howItWorks/MeasuresSection'
import { ListSection, sectionAnchor } from '../components/howItWorks/MethodSection'
import { MonthsSection } from '../components/howItWorks/MonthsSection'
import { PointsSection } from '../components/howItWorks/PointsSection'
import { PageHead } from '../components/PageHead'
import styles from './HowItWorksPage.module.css'

const LIMITATIONS = [
  'howItWorks.limits.plan',
  'howItWorks.limits.card',
  'howItWorks.limits.anchors',
  'howItWorks.limits.stability',
  'howItWorks.limits.file',
  'howItWorks.limits.categories',
  'howItWorks.limits.savings',
  'howItWorks.limits.rates',
]

const PRIVACY = [
  'howItWorks.privacy.browser',
  'howItWorks.privacy.nothingSaved',
  'howItWorks.privacy.prefs',
  'howItWorks.privacy.noTracking',
]

/** The sections, in the order they appear, by their headings' message ids. */
const SECTIONS = [
  'howItWorks.measures.title',
  'howItWorks.points.title',
  'howItWorks.bands.title',
  'howItWorks.months.title',
  'howItWorks.categories.title',
  'howItWorks.framework.title',
  'howItWorks.limits.title',
  'howItWorks.privacy.title',
]

/**
 * A link to each section. The router owns the page's hash, so a section's address is
 * #/how-it-works#points: the page itself scrolls there and moves focus to the heading, so a
 * screen reader reads on from it.
 */
function Contents() {
  const titleId = useId()

  return (
    <nav className={styles.contents} aria-labelledby={titleId}>
      <p id={titleId} className={styles.contentsTitle}>
        <FormattedMessage id="howItWorks.contents.title" />
      </p>
      <ol className={styles.contentsList}>
        {SECTIONS.map((id) => (
          <li key={id}>
            <Link to={{ hash: sectionAnchor(id) }} className={styles.contentsLink}>
              <FormattedMessage id={id} />
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** Brings the section named in the address into view, with focus on its heading. */
function useSectionFromAddress() {
  const { hash, key } = useLocation()

  useEffect(() => {
    const anchor = decodeURIComponent(hash.slice(1))
    if (!anchor) return
    const section = document.getElementById(anchor)
    const heading = section?.querySelector<HTMLElement>('h2')
    if (!section || !heading) return
    section.scrollIntoView({ block: 'start' })
    heading.focus({ preventScroll: true })
    // `key` too: following the same link again comes back to the section.
  }, [hash, key])
}

/**
 * The method in plain language (spec 5). Every weight, anchor point, band, threshold and
 * worked figure on it is read from the scoring code, so the page always says what it does.
 */
export function HowItWorksPage() {
  useSectionFromAddress()

  return (
    <div className={styles.page}>
      <PageHead title={<FormattedMessage id="howItWorks.title" />}>
        <p>
          <FormattedMessage id="howItWorks.lead" />
        </p>
      </PageHead>
      <Contents />
      <MeasuresSection />
      <PointsSection />
      <BandsSection />
      <MonthsSection />
      <CategoriesSection />
      <FrameworkSection />
      <ListSection titleId="howItWorks.limits.title" itemIds={LIMITATIONS} />
      <ListSection titleId="howItWorks.privacy.title" itemIds={PRIVACY} />
    </div>
  )
}
