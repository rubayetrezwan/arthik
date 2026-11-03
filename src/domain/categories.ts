import type { CategoryId, Group } from './types'

export type Direction = 'in' | 'out' | 'any'

export interface CategoryInfo {
  id: CategoryId
  group: Group
  direction: Direction
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: 'salary', group: 'income', direction: 'in' },
  { id: 'freelance', group: 'income', direction: 'in' },
  { id: 'side_income', group: 'income', direction: 'in' },
  { id: 'family_support_in', group: 'income', direction: 'in' },
  { id: 'remittance_in', group: 'income', direction: 'in' },
  { id: 'other_income', group: 'income', direction: 'in' },

  { id: 'rent', group: 'essential', direction: 'out' },
  { id: 'utilities', group: 'essential', direction: 'out' },
  { id: 'groceries', group: 'essential', direction: 'out' },
  { id: 'transport', group: 'essential', direction: 'out' },
  { id: 'education', group: 'essential', direction: 'out' },
  { id: 'healthcare', group: 'essential', direction: 'out' },
  { id: 'mobile_internet', group: 'essential', direction: 'out' },
  { id: 'family_support_out', group: 'essential', direction: 'out' },
  { id: 'fees', group: 'essential', direction: 'out' },

  { id: 'eating_out', group: 'want', direction: 'out' },
  { id: 'shopping', group: 'want', direction: 'out' },
  { id: 'entertainment', group: 'want', direction: 'out' },
  { id: 'travel', group: 'want', direction: 'out' },
  { id: 'personal_care', group: 'want', direction: 'out' },

  { id: 'gifts', group: 'other_spending', direction: 'out' },

  { id: 'loan_emi', group: 'debt', direction: 'out' },
  { id: 'card_payment', group: 'debt', direction: 'out' },
  { id: 'bnpl', group: 'debt', direction: 'out' },

  { id: 'savings_deposit', group: 'savings', direction: 'out' },
  { id: 'investments', group: 'savings', direction: 'out' },

  { id: 'cash_withdrawal', group: 'cash', direction: 'out' },

  { id: 'refund', group: 'refund', direction: 'in' },

  // A transfer between the visitor's own accounts appears on both sides.
  { id: 'own_transfer', group: 'not_counted', direction: 'any' },
  { id: 'cash_deposit', group: 'not_counted', direction: 'in' },
  { id: 'savings_withdrawal', group: 'not_counted', direction: 'in' },
  { id: 'loan_received', group: 'not_counted', direction: 'in' },

  { id: 'uncategorised_out', group: 'uncategorised', direction: 'out' },
]

const BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]))

export function groupOf(id: CategoryId): Group {
  const category = BY_ID.get(id)
  if (!category) throw new Error(`Unknown category "${String(id)}"`)
  return category.group
}

/** Categories a visitor may pick for a payment in this direction, including 'any'. */
export function categoriesFor(direction: 'in' | 'out'): CategoryId[] {
  return CATEGORIES.filter(
    (category) => category.direction === direction || category.direction === 'any',
  ).map((category) => category.id)
}
