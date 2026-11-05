// Checks the shape of a sample file, so a bad edit fails loudly instead of scoring wrongly.

import { CATEGORIES } from '../../domain/categories'
import {
  CURRENCY_CODES,
  type CurrencyCode,
  type Dataset,
  type PersonId,
  type Transaction,
} from '../../domain/types'

const CATEGORY_IDS: ReadonlySet<string> = new Set(CATEGORIES.map((category) => category.id))
const CURRENCIES: ReadonlySet<string> = new Set(CURRENCY_CODES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTransaction(raw: unknown, where: string): Transaction {
  if (!isRecord(raw)) throw new Error(`${where}: expected an object`)
  const { id, date, description, amount, currency, category, unrecognisedIncome } = raw
  if (typeof id !== 'string' || typeof description !== 'string') {
    throw new Error(`${where}: id and description must be text`)
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`${where}: date must be YYYY-MM-DD`)
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error(`${where}: amount must be a number`)
  }
  if (typeof currency !== 'string' || !CURRENCIES.has(currency)) {
    throw new Error(`${where}: unknown currency ${String(currency)}`)
  }
  if (typeof category !== 'string' || !CATEGORY_IDS.has(category)) {
    throw new Error(`${where}: unknown category ${String(category)}`)
  }
  if (unrecognisedIncome !== undefined && typeof unrecognisedIncome !== 'boolean') {
    throw new Error(`${where}: unrecognisedIncome must be true or false`)
  }
  return {
    id,
    date,
    description,
    amount,
    currency: currency as CurrencyCode,
    category: category as Transaction['category'],
    ...(unrecognisedIncome ? { unrecognisedIncome } : {}),
  }
}

export function parseSample(key: PersonId, raw: unknown): Dataset {
  if (!isRecord(raw) || raw.key !== key || !Array.isArray(raw.transactions)) {
    throw new Error(`${key}: expected a dataset with key "${key}" and a list of transactions`)
  }

  const saved = raw.emergencySavings
  if (
    !isRecord(saved) ||
    typeof saved.amount !== 'number' ||
    !CURRENCIES.has(String(saved.currency))
  ) {
    throw new Error(`${key}: emergencySavings needs an amount and a currency`)
  }

  return {
    key,
    emergencySavings: { amount: saved.amount, currency: saved.currency as CurrencyCode },
    transactions: raw.transactions.map((item, index) =>
      parseTransaction(item, `${key} #${index + 1}`),
    ),
  }
}
