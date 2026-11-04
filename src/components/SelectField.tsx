import { useId, type ComponentProps } from 'react'
import styles from './SelectField.module.css'

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'className' | 'id'> {
  /** Read by screen readers. The options make the purpose plain to everyone else. */
  label: string
}

/** A native select, styled like the ledger's other controls. */
export function SelectField({ label, children, ...select }: SelectFieldProps) {
  const id = useId()

  return (
    <div className={styles.field}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <select id={id} className={styles.select} {...select}>
        {children}
      </select>
    </div>
  )
}
