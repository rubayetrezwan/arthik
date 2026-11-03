import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoriesFor, groupOf } from './categories'
import type { CategoryId } from './types'

// Typed as a Record so the compiler fails if a CategoryId is added or removed
// without updating this list.
const EXPECTED_IDS: Record<CategoryId, true> = {
  salary: true,
  freelance: true,
  side_income: true,
  family_support_in: true,
  remittance_in: true,
  other_income: true,
  rent: true,
  utilities: true,
  groceries: true,
  transport: true,
  education: true,
  healthcare: true,
  mobile_internet: true,
  family_support_out: true,
  fees: true,
  eating_out: true,
  shopping: true,
  entertainment: true,
  travel: true,
  personal_care: true,
  gifts: true,
  loan_emi: true,
  card_payment: true,
  bnpl: true,
  savings_deposit: true,
  investments: true,
  cash_withdrawal: true,
  refund: true,
  own_transfer: true,
  cash_deposit: true,
  savings_withdrawal: true,
  loan_received: true,
  uncategorised_out: true,
}

describe('CATEGORIES', () => {
  it('lists every CategoryId exactly once', () => {
    const ids = CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(Object.keys(EXPECTED_IDS).sort())
  })
})

describe('groupOf', () => {
  it('maps categories to their score group', () => {
    expect(groupOf('eating_out')).toBe('want')
    expect(groupOf('family_support_out')).toBe('essential')
    expect(groupOf('cash_withdrawal')).toBe('cash')
    expect(groupOf('loan_received')).toBe('not_counted')
    expect(groupOf('gifts')).toBe('other_spending')
  })

  it('covers the remaining groups', () => {
    expect(groupOf('salary')).toBe('income')
    expect(groupOf('card_payment')).toBe('debt')
    expect(groupOf('investments')).toBe('savings')
    expect(groupOf('refund')).toBe('refund')
    expect(groupOf('uncategorised_out')).toBe('uncategorised')
  })
})

describe('categoriesFor', () => {
  it('offers income categories and own_transfer for money in', () => {
    const incoming = categoriesFor('in')
    expect(incoming).toContain('salary')
    expect(incoming).toContain('own_transfer')
    expect(incoming).toContain('refund')
    expect(incoming).toContain('loan_received')
    expect(incoming).not.toContain('rent')
  })

  it('offers spending categories and own_transfer for money out', () => {
    const outgoing = categoriesFor('out')
    expect(outgoing).toContain('rent')
    expect(outgoing).toContain('own_transfer')
    expect(outgoing).toContain('uncategorised_out')
    expect(outgoing).not.toContain('salary')
    expect(outgoing).not.toContain('refund')
  })
})
