import { useId, type Ref } from 'react'
import { FormattedMessage } from 'react-intl'
import { MEASURE_IDS } from '../domain/score'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { parseAmount } from '../domain/csvCells'
import type { CurrencyCode } from '../domain/types'
import styles from './SavingsField.module.css'

export type SavingsReading =
  { kind: 'empty' } | { kind: 'amount'; amount: number } | { kind: 'invalid' }

// Digits (Western or Bengali), commas or spaces between thousands, and a point before decimals.
// A sign, a bracket or a currency sign is not taken: the amount is in the currency on screen, so
// "$500" beside taka would be read as ৳500.
const SAVINGS_TEXT = /^[\d\u{9E6}-\u{9EF}.,\s]+$/u

/**
 * Reads the emergency savings as typed: nothing, an amount of zero or more, or something that
 * is not one. Anything not a finite number of zero or more is invalid, never an amount, since a
 * NaN would score as full marks (Task 5). Thousands are read as the CSV reader reads them, so
 * 12,50 and 1.500 are invalid rather than guessed at.
 */
export function readSavings(text: string): SavingsReading {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'empty' }
  if (!SAVINGS_TEXT.test(trimmed)) return { kind: 'invalid' }
  const amount = parseAmount(trimmed)
  return amount !== null && Number.isFinite(amount) && amount >= 0
    ? { kind: 'amount', amount }
    : { kind: 'invalid' }
}

interface SavingsFieldProps {
  value: string
  onChange(text: string): void
  invalid: boolean
  /** The display currency, which the amount is in. */
  currency: CurrencyCode
  inputRef: Ref<HTMLInputElement>
}

/** The emergency savings, in the display currency. */
export function SavingsField({ value, onChange, invalid, currency, inputRef }: SavingsFieldProps) {
  const locale = useLocale()
  const id = useId()
  const hintId = useId()
  const errorId = useId()

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        <FormattedMessage id="upload.savings.label" />
      </label>
      <p id={hintId} className={styles.hint}>
        <FormattedMessage
          id="upload.savings.hint"
          values={{
            currency,
            scored: formatNumber(MEASURE_IDS.length - 1, locale),
            total: formatNumber(MEASURE_IDS.length, locale),
          }}
        />
      </p>
      <div className={styles.row}>
        <span className={styles.unit} aria-hidden="true">
          {currency}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          value={value}
          aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {invalid && (
        <p id={errorId} className={styles.problem}>
          <FormattedMessage id="upload.savings.invalid" />
        </p>
      )}
    </div>
  )
}
