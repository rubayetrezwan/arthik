// Test support: small datasets with hand-checked numbers, shared by the tests
// for measures, scoring, tips and what-if. Not imported by the app itself.

import type { RatesSnapshot } from './currency'
import type { CategoryId, Dataset, Transaction } from './types'

let nextId = 1

/**
 * Builds one transaction. Defaults to BDT, and the description is the category
 * name. Every call gets a fresh unique `id`, so fixtures never collide.
 * Pass `extra` to override anything else, for example `{ currency: 'USD' }`.
 */
export function tx(
  date: string,
  category: CategoryId,
  amount: number,
  extra: Partial<Omit<Transaction, 'date' | 'category' | 'amount'>> = {},
): Transaction {
  return {
    id: `fx-${nextId++}`,
    description: category,
    currency: 'BDT',
    ...extra,
    date,
    category,
    amount,
  }
}

/** Fixed exchange rates, so tests do not move when the bundled rates are refreshed. */
export const fixtureRates: RatesSnapshot = {
  base: 'BDT',
  date: '2026-11-03',
  source: 'Test fixture',
  sourceUrl: 'https://example.test',
  perBDT: {
    BDT: 1,
    USD: 0.008, // 1 USD = 125 BDT
    EUR: 0.007,
    JPY: 1.2,
    GBP: 0.006,
    CNY: 0.057,
    CHF: 0.0065,
    AUD: 0.0125,
    CAD: 0.011,
    HKD: 0.062,
    SGD: 0.0105,
  },
}

/**
 * Three complete months, January to March 2026, all in BDT.
 *
 * Every month: salary 50,000 in on the 1st, then rent 15,000, groceries 8,000,
 * eating out 6,000, loan EMI 5,000, savings deposit 3,000, an own-account
 * transfer of 2,000 and a cash withdrawal of 2,000 on the last day.
 * February adds a 1,000 refund and a 20,000 loan received. March adds 3,000 of
 * unrecognised money in, counted as other income.
 *
 * Hand-checked totals over the three months:
 * - income 153,000 (3 x 50,000 + 3,000)
 * - spending 92,000, which is 31,000 + 30,000 + 31,000 (February is 1,000 lower
 *   because of the refund)
 * - essentials 69,000, wants 18,000, debt payments 15,000
 * - emergency savings 46,000, which is 2 months of the 23,000 average essentials
 */
export const fixtureA: Dataset = {
  key: 'mine',
  emergencySavings: { amount: 46_000, currency: 'BDT' },
  transactions: [
    // January
    tx('2026-01-01', 'salary', 50_000),
    tx('2026-01-03', 'rent', -15_000),
    tx('2026-01-08', 'groceries', -8_000),
    tx('2026-01-12', 'eating_out', -6_000),
    tx('2026-01-15', 'loan_emi', -5_000),
    tx('2026-01-18', 'savings_deposit', -3_000),
    tx('2026-01-22', 'own_transfer', -2_000),
    tx('2026-01-31', 'cash_withdrawal', -2_000),
    // February
    tx('2026-02-01', 'salary', 50_000),
    tx('2026-02-03', 'rent', -15_000),
    tx('2026-02-08', 'groceries', -8_000),
    tx('2026-02-10', 'refund', 1_000),
    tx('2026-02-12', 'eating_out', -6_000),
    tx('2026-02-14', 'loan_received', 20_000),
    tx('2026-02-15', 'loan_emi', -5_000),
    tx('2026-02-18', 'savings_deposit', -3_000),
    tx('2026-02-22', 'own_transfer', -2_000),
    tx('2026-02-28', 'cash_withdrawal', -2_000),
    // March
    tx('2026-03-01', 'salary', 50_000),
    tx('2026-03-03', 'rent', -15_000),
    tx('2026-03-08', 'groceries', -8_000),
    tx('2026-03-12', 'eating_out', -6_000),
    tx('2026-03-15', 'loan_emi', -5_000),
    tx('2026-03-16', 'other_income', 3_000, { unrecognisedIncome: true }),
    tx('2026-03-18', 'savings_deposit', -3_000),
    tx('2026-03-22', 'own_transfer', -2_000),
    tx('2026-03-31', 'cash_withdrawal', -2_000),
  ],
}
