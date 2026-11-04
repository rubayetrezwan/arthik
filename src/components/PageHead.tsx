import type { ReactNode } from 'react'
import styles from './PageHead.module.css'

interface PageHeadProps {
  /** A small line above the heading, such as "Sample: Nusrat, …". */
  kicker?: ReactNode
  title: ReactNode
  /** What follows the heading: a line or two of plain text. */
  children?: ReactNode
}

/** The top of a page: the one h1, with its kicker and opening lines. */
export function PageHead({ kicker, title, children }: PageHeadProps) {
  return (
    <div className={styles.head}>
      {kicker && <p className={styles.kicker}>{kicker}</p>}
      <h1 className={styles.title}>{title}</h1>
      {children && <div className={styles.lead}>{children}</div>}
    </div>
  )
}
