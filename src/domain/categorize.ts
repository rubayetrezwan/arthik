// Assigns a category to a transaction from its description and the sign of its
// amount (spec 5.3). The rules themselves are data, in src/data/merchants.ts.
// Pure: no React, no DOM.

import { RULES, type Rule } from '../data/merchants'
import type { CategoryId } from './types'

export { RULES }
export type { Rule }

export interface CategorizeResult {
  category: CategoryId
  /** True when money came in and nothing matched, so it was counted as other income. */
  unrecognisedIncome: boolean
}

/**
 * Puts a description in a form the rules can rely on: Unicode NFC, no apostrophes,
 * dashes and underscores as spaces, one space between words, no zero-width characters.
 * Case is left alone because every rule is case-insensitive.
 */
export function normalise(description: string): string {
  return description
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/['\u2018\u2019`\u00B4]/g, '')
    .replace(/[-_\u2010-\u2015]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first rule that matches the description and fits the sign of the amount wins.
 * Money in that matches nothing is counted as other income and flagged, because most
 * money arriving in a personal account is income (spec 5.3). Money out that matches
 * nothing is uncategorised.
 */
export function categorize(description: string, amount: number): CategorizeResult {
  // A zero amount (or NaN from bad input) is neither money in nor money out, so there is
  // nothing to flag as income. Treat it as an uncategorised outflow; it adds nothing.
  if (!(amount > 0 || amount < 0)) {
    return { category: 'uncategorised_out', unrecognisedIncome: false }
  }

  const direction = amount > 0 ? 'in' : 'out'
  const text = normalise(description)
  for (const rule of RULES) {
    if (rule.direction !== 'any' && rule.direction !== direction) continue
    if (rule.pattern.test(text)) return { category: rule.category, unrecognisedIncome: false }
  }

  return direction === 'in'
    ? { category: 'other_income', unrecognisedIncome: true }
    : { category: 'uncategorised_out', unrecognisedIncome: false }
}
