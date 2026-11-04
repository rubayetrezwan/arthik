import { FormattedMessage } from 'react-intl'
import { UnfinishedPage } from './UnfinishedPage'

// The method is written up in its own step (plan Task 15).
export function HowItWorksPage() {
  return <UnfinishedPage title={<FormattedMessage id="howItWorks.title" />} />
}
