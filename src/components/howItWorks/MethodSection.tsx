import { useId, type ReactNode } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './Method.module.css'

interface MethodSectionProps {
  /** The message id of the section's heading. */
  titleId: string
  /** The section's content, or a function that gets the heading's element id to name a table by. */
  children: ReactNode | ((headingId: string) => ReactNode)
}

/**
 * The section's place on the page, from its heading's message id: howItWorks.points.title is
 * "points", so #/how-it-works#points leads to it.
 */
export function sectionAnchor(titleId: string): string {
  return titleId.replace(/^howItWorks\./, '').replace(/\.title$/, '')
}

/** One ruled section of "How the score works", named by its h2. */
export function MethodSection({ titleId, children }: MethodSectionProps) {
  const headingId = useId()

  return (
    <section className={styles.section} aria-labelledby={headingId} id={sectionAnchor(titleId)}>
      {/* Focusable so the contents list can move focus here. */}
      <h2 id={headingId} className={styles.heading} tabIndex={-1}>
        <FormattedMessage id={titleId} />
      </h2>
      {typeof children === 'function' ? children(headingId) : children}
    </section>
  )
}

/** A subsection with an h3, inside a MethodSection. */
export function SubSection({ titleId, className, children }: MethodSectionProps & { className?: string }) {
  const headingId = useId()

  return (
    <section className={className ?? styles.sub}>
      <h3 id={headingId} className={styles.subHeading}>
        <FormattedMessage id={titleId} />
      </h3>
      {typeof children === 'function' ? children(headingId) : children}
    </section>
  )
}

/** A heading and a ruled list of plain sentences, one message each. */
export function ListSection({ titleId, itemIds }: { titleId: string; itemIds: readonly string[] }) {
  return (
    <MethodSection titleId={titleId}>
      <ul className={styles.list}>
        {itemIds.map((id) => (
          <li key={id}>
            <FormattedMessage id={id} />
          </li>
        ))}
      </ul>
    </MethodSection>
  )
}
