import { FormattedMessage, useIntl } from 'react-intl'
import { useActiveDataset } from '../state/session'
import { UnfinishedPage } from './UnfinishedPage'

// The score sheet is built in its own steps (plan Tasks 12 and 13). Until then the page
// already names whose transactions are shown.
export function DashboardPage() {
  const intl = useIntl()
  const dataset = useActiveDataset()
  if (!dataset) return null

  const kicker =
    dataset.key === 'mine' ? (
      <FormattedMessage id="score.kicker.mine" />
    ) : (
      <FormattedMessage
        id="score.kicker.sample"
        values={{
          name: intl.formatMessage({ id: `person.${dataset.key}.name` }),
          role: intl.formatMessage({ id: `person.${dataset.key}.role` }),
        }}
      />
    )

  return <UnfinishedPage kicker={kicker} title={<FormattedMessage id="score.title" />} />
}
