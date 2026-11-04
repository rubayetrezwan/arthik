// Core domain types shared by every layer. Pure TypeScript: no React, no DOM.

export const CURRENCY_CODES = [
  'BDT',
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'CNY',
  'CHF',
  'AUD',
  'CAD',
  'HKD',
  'SGD',
] as const

export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value)
}

export type PersonId = 'nusrat' | 'tanvir' | 'farhana' | 'arif' | 'rahim'

export type CategoryId =
  // Income
  | 'salary'
  | 'freelance'
  | 'side_income'
  | 'family_support_in'
  | 'remittance_in'
  | 'other_income'
  // Essentials
  | 'rent'
  | 'utilities'
  | 'groceries'
  | 'transport'
  | 'education'
  | 'healthcare'
  | 'mobile_internet'
  | 'family_support_out'
  | 'fees'
  // Wants
  | 'eating_out'
  | 'shopping'
  | 'entertainment'
  | 'travel'
  | 'personal_care'
  // Other spending
  | 'gifts'
  // Debt payments
  | 'loan_emi'
  | 'card_payment'
  | 'bnpl'
  // Savings
  | 'savings_deposit'
  | 'investments'
  // Cash
  | 'cash_withdrawal'
  // Refunds
  | 'refund'
  // Not counted
  | 'own_transfer'
  | 'cash_deposit'
  | 'savings_withdrawal'
  | 'loan_received'
  // Uncategorised
  | 'uncategorised_out'

export type Group =
  | 'income'
  | 'essential'
  | 'want'
  | 'other_spending'
  | 'debt'
  | 'savings'
  | 'cash'
  | 'refund'
  | 'not_counted'
  | 'uncategorised'

export interface Transaction {
  id: string
  /** YYYY-MM-DD */
  date: string
  description: string
  /** Positive for money in, negative for money out, in major units. */
  amount: number
  currency: CurrencyCode
  category: CategoryId
  /** Set when money in was not recognised and defaulted to other income. */
  unrecognisedIncome?: boolean
}

export interface Dataset {
  key: PersonId | 'mine'
  transactions: Transaction[]
  emergencySavings: { amount: number; currency: CurrencyCode } | null
}
