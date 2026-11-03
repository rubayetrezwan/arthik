import type { CategoryId } from './types'

/**
 * English names for the categories, as written in spec 5.3. A CSV may name a
 * category by one of these (or by its id) in its `category` column.
 *
 * This table exists only so English CSVs can be read. The interface shows
 * translated names from its own messages, not from here.
 */
export const CATEGORY_LABELS_EN: Record<CategoryId, string> = {
  salary: 'Salary',
  freelance: 'Freelance income',
  side_income: 'Side income',
  family_support_in: 'Family support received',
  remittance_in: 'Remittance received',
  other_income: 'Other income',

  rent: 'Rent & housing',
  utilities: 'Utilities',
  groceries: 'Groceries',
  transport: 'Transport',
  education: 'Education',
  healthcare: 'Healthcare',
  mobile_internet: 'Mobile & internet',
  family_support_out: 'Family support sent',
  fees: 'Fees & charges',

  eating_out: 'Eating out & delivery',
  shopping: 'Shopping',
  entertainment: 'Entertainment & subscriptions',
  travel: 'Travel & holidays',
  personal_care: 'Personal care',

  gifts: 'Gifts & donations',

  loan_emi: 'Loan EMI',
  card_payment: 'Credit card payment',
  bnpl: 'Buy-now-pay-later instalment',

  savings_deposit: 'Savings deposit / DPS',
  investments: 'Sanchayapatra & investments',

  cash_withdrawal: 'Cash withdrawal',

  refund: 'Refund or reversal',

  own_transfer: 'Own-account transfer',
  cash_deposit: 'Cash deposit',
  savings_withdrawal: 'Savings withdrawal',
  loan_received: 'Loan received',

  uncategorised_out: 'Uncategorised',
}
