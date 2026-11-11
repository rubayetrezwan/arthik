import { useId, type ComponentProps } from 'react'
import styles from './SelectField.module.css'

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'className' | 'id'> {
  /** Read by screen readers. The options make the purpose plain to everyone else. */
  label: string
  /** An extra class for the box around the select, such as one that draws a small sign in it. */
  fieldClassName?: string
}

/** A native select, styled like the ledger's other controls. */
export function SelectField({ label, fieldClassName, children, ...select }: SelectFieldProps) {
  const id = useId()

  return (
    <div className={fieldClassName ? `${styles.field} ${fieldClassName}` : styles.field}>
      <label className="visually-hidden" htmlFor={id}>
        {label}
      </label>
      <select id={id} className={styles.select} {...select}>
        {children}
      </select>
    </div>
  )
}
