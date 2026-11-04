import type { ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import { PageHead } from '../components/PageHead'

/** Holds a route's place until its page is written: a heading and one plain line. */
export function UnfinishedPage({ kicker, title }: { kicker?: ReactNode; title: ReactNode }) {
  return (
    <PageHead kicker={kicker} title={title}>
      <p>
        <FormattedMessage id="page.unfinished" />
      </p>
    </PageHead>
  )
}
