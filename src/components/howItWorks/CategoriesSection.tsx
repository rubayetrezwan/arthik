import { FormattedMessage, useIntl, type IntlShape } from 'react-intl'
import { CATEGORIES } from '../../domain/categories'
import { RATES } from '../../domain/currency'
import type { CategoryId, Group } from '../../domain/types'
import { formatFullDate } from '../../i18n/format'
import { useLocale } from '../../i18n/I18nProvider'
import styles from './Method.module.css'
import { MethodSection, SubSection } from './MethodSection'

// Category and group names are read through these two functions only, so they can move to
// the shared category messages in one place.
function categoryName(intl: IntlShape, id: CategoryId): string {
  return intl.formatMessage({ id: `howItWorks.category.${id}` })
}

function groupName(intl: IntlShape, group: Group): string {
  return intl.formatMessage({ id: `howItWorks.group.${group}` })
}

/** The groups in the order CATEGORIES first lists them, each with its categories. */
function groupedCategories(): { group: Group; ids: CategoryId[] }[] {
  const groups = new Map<Group, CategoryId[]>()
  for (const { id, group } of CATEGORIES) {
    groups.set(group, [...(groups.get(group) ?? []), id])
  }
  return [...groups].map(([group, ids]) => ({ group, ids }))
}

const RULES = ['cash', 'refunds', 'unrecognised', 'accounts', 'card', 'family', 'currency'] as const

/** How the categories are grouped and what each group does, then the rules for particular payments. */
export function CategoriesSection() {
  const intl = useIntl()
  const locale = useLocale()

  const names = {
    fees: categoryName(intl, 'fees'),
    otherIncome: categoryName(intl, 'other_income'),
    ownTransfer: categoryName(intl, 'own_transfer'),
    familyOut: categoryName(intl, 'family_support_out'),
    notCounted: groupName(intl, 'not_counted'),
    source: RATES.source,
    date: formatFullDate(RATES.date, locale),
  }

  return (
    <MethodSection titleId="howItWorks.categories.title">
      {(headingId) => (
        <>
          <p className={styles.intro}>
            <FormattedMessage id="howItWorks.categories.intro" />
          </p>
          <table className={`${styles.table} ${styles.stack}`} aria-labelledby={headingId}>
            <thead>
              <tr>
                <th scope="col">
                  <FormattedMessage id="howItWorks.categories.group" />
                </th>
                <th scope="col">
                  <FormattedMessage id="howItWorks.categories.treatment" />
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedCategories().map(({ group, ids }) => (
                <tr key={group}>
                  <th scope="row">
                    <span className={styles.name}>{groupName(intl, group)}</span>
                    <span className={styles.detail}>
                      {intl.formatList(
                        ids.map((id) => categoryName(intl, id)),
                        { type: 'unit' },
                      )}
                    </span>
                  </th>
                  <td>
                    <FormattedMessage id={`howItWorks.group.${group}.treatment`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.rules}>
            {RULES.map((rule) => (
              <SubSection key={rule} titleId={`howItWorks.rules.${rule}.title`} className={styles.rule}>
                <p className={styles.prose}>
                  <FormattedMessage id={`howItWorks.rules.${rule}.text`} values={names} />
                </p>
              </SubSection>
            ))}
          </div>
        </>
      )}
    </MethodSection>
  )
}
