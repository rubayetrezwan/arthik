import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoriesFor, groupOf, type Direction } from './categories'
import type { CategoryId, Group } from './types'

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

// The group of each category as written in spec 5.3, typed as a Record so the
// compiler fails if a CategoryId is added without a decision here. The score
// depends on this mapping: a category in the wrong group changes every measure.
const EXPECTED: Record<CategoryId, { group: Group; direction: Direction }> = {
  // Income
  salary: { group: 'income', direction: 'in' },
  freelance: { group: 'income', direction: 'in' },
  side_income: { group: 'income', direction: 'in' },
  family_support_in: { group: 'income', direction: 'in' },
  remittance_in: { group: 'income', direction: 'in' },
  other_income: { group: 'income', direction: 'in' },
  // Essentials (family support sent is a need, not a want)
  rent: { group: 'essential', direction: 'out' },
  utilities: { group: 'essential', direction: 'out' },
  groceries: { group: 'essential', direction: 'out' },
  transport: { group: 'essential', direction: 'out' },
  education: { group: 'essential', direction: 'out' },
  healthcare: { group: 'essential', direction: 'out' },
  mobile_internet: { group: 'essential', direction: 'out' },
  family_support_out: { group: 'essential', direction: 'out' },
  fees: { group: 'essential', direction: 'out' },
  // Wants
  eating_out: { group: 'want', direction: 'out' },
  shopping: { group: 'want', direction: 'out' },
  entertainment: { group: 'want', direction: 'out' },
  travel: { group: 'want', direction: 'out' },
  personal_care: { group: 'want', direction: 'out' },
  // Other spending: counts as spending, neither a need nor a want
  gifts: { group: 'other_spending', direction: 'out' },
  // Debt payments: debt load, not spending
  loan_emi: { group: 'debt', direction: 'out' },
  card_payment: { group: 'debt', direction: 'out' },
  bnpl: { group: 'debt', direction: 'out' },
  // Savings & investments: money kept, not spending
  savings_deposit: { group: 'savings', direction: 'out' },
  investments: { group: 'savings', direction: 'out' },
  // Cash: assumed spent, left out of needs-vs-wants
  cash_withdrawal: { group: 'cash', direction: 'out' },
  // Refunds: reduce spending, not income
  refund: { group: 'refund', direction: 'in' },
  // Not counted: ignored entirely (an own-account transfer shows on both sides)
  own_transfer: { group: 'not_counted', direction: 'any' },
  cash_deposit: { group: 'not_counted', direction: 'in' },
  savings_withdrawal: { group: 'not_counted', direction: 'in' },
  loan_received: { group: 'not_counted', direction: 'in' },
  // Uncategorised money out: spending, left out of needs-vs-wants
  uncategorised_out: { group: 'uncategorised', direction: 'out' },
}

describe('CATEGORIES', () => {
  it('lists every CategoryId exactly once', () => {
    const ids = CATEGORIES.map((category) => category.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(Object.keys(EXPECTED_IDS).sort())
  })

  it('puts every category in the group and direction the spec gives it', () => {
    expect(CATEGORIES).toHaveLength(Object.keys(EXPECTED).length)
    for (const category of CATEGORIES) {
      expect(
        { group: category.group, direction: category.direction },
        `category "${category.id}"`,
      ).toEqual(EXPECTED[category.id])
    }
  })

  it('agrees with groupOf for every category', () => {
    for (const id of Object.keys(EXPECTED) as CategoryId[]) {
      expect(groupOf(id), `category "${id}"`).toBe(EXPECTED[id].group)
    }
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
