import { useIntl } from 'react-intl'
import { categoriesFor, CATEGORIES } from '../domain/categories'
import type { CategoryId, Group } from '../domain/types'
import styles from './CategorySelect.module.css'
import { SelectField } from './SelectField'

interface CategorySelectProps {
  value: CategoryId
  /** Money in or out: only the categories that fit it are offered. */
  direction: 'in' | 'out'
  /** Read by screen readers, such as "Category for Foodpanda order". */
  label: string
  onChange(category: CategoryId): void
  /** The id of text that says more about this transaction, such as a "check it" flag. */
  describedBy?: string
}

/**
 * The categories offered, in the table's order and grouped by how the score treats them.
 * The current category is always among them, even one that would not normally fit.
 */
function groupedChoices(direction: 'in' | 'out', current: CategoryId) {
  const fits = new Set<CategoryId>([...categoriesFor(direction), current])
  const groups: { group: Group; ids: CategoryId[] }[] = []
  for (const { id, group } of CATEGORIES) {
    if (!fits.has(id)) continue
    const last = groups.at(-1)
    if (last?.group === group) last.ids.push(id)
    else groups.push({ group, ids: [id] })
  }
  return groups
}

/** A transaction's category, as a native select the visitor can change. */
export function CategorySelect({ value, direction, label, onChange, describedBy }: CategorySelectProps) {
  const intl = useIntl()
  const groups = groupedChoices(direction, value)

  return (
    <div className={styles.category}>
      <SelectField
        label={label}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => {
          const chosen = groups
            .flatMap(({ ids }) => ids)
            .find((id) => id === event.target.value)
          if (chosen) onChange(chosen)
        }}
      >
        {groups.map(({ group, ids }) => (
          <optgroup key={group} label={intl.formatMessage({ id: `group.${group}` })}>
            {ids.map((id) => (
              <option key={id} value={id}>
                {intl.formatMessage({ id: `category.${id}` })}
              </option>
            ))}
          </optgroup>
        ))}
      </SelectField>
    </div>
  )
}
