import { describe, expect, it } from 'vitest'
import { CATEGORIES } from './categories'
import { CATEGORY_LABELS_EN } from './categoryLabels'
import type { CategoryId } from './types'

describe('CATEGORY_LABELS_EN', () => {
  it('names every category', () => {
    for (const { id } of CATEGORIES) {
      expect(CATEGORY_LABELS_EN[id], id).toBeTruthy()
    }
    expect(Object.keys(CATEGORY_LABELS_EN)).toHaveLength(CATEGORIES.length)
  })

  it('never lets one name or id stand for two categories', () => {
    // A CSV category is matched case-insensitively against ids and names together.
    // A category's own name may equal its id ("Salary" and salary); no other overlap is allowed.
    const owner = new Map<string, CategoryId>()
    for (const { id } of CATEGORIES) {
      for (const key of [id, CATEGORY_LABELS_EN[id].toLowerCase()]) {
        expect(owner.get(key) ?? id, key).toBe(id)
        owner.set(key, id)
      }
    }
  })

  it('uses the spec 5.3 wording', () => {
    expect(CATEGORY_LABELS_EN.eating_out).toBe('Eating out & delivery')
    expect(CATEGORY_LABELS_EN.rent).toBe('Rent & housing')
    expect(CATEGORY_LABELS_EN.mobile_internet).toBe('Mobile & internet')
    expect(CATEGORY_LABELS_EN.savings_deposit).toBe('Savings deposit / DPS')
    expect(CATEGORY_LABELS_EN.investments).toBe('Sanchayapatra & investments')
    expect(CATEGORY_LABELS_EN.uncategorised_out).toBe('Uncategorised')
  })
})
