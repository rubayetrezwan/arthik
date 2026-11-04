import { FormattedMessage } from 'react-intl'
import { UnfinishedPage } from './UnfinishedPage'

// The upload flow is built in its own step (plan Task 14).
export function UploadPage() {
  return <UnfinishedPage title={<FormattedMessage id="upload.title" />} />
}
