import { FormattedMessage } from 'react-intl'
import { BandsSection } from '../components/howItWorks/BandsSection'
import { CategoriesSection } from '../components/howItWorks/CategoriesSection'
import { FrameworkSection } from '../components/howItWorks/FrameworkSection'
import { MeasuresSection } from '../components/howItWorks/MeasuresSection'
import { ListSection } from '../components/howItWorks/MethodSection'
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

/**
 * The method in plain language (spec 5). Every weight, anchor point, band, threshold and
 * worked figure on it is read from the scoring code, so the page always says what it does.
 */
export function HowItWorksPage() {
  return (
    <div className={styles.page}>
      <PageHead title={<FormattedMessage id="howItWorks.title" />}>
        <p>
          <FormattedMessage id="howItWorks.lead" />
        </p>
      </PageHead>
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
