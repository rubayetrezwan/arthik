import { useId, useState, type FormEvent } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { usePrefs } from '../state/prefs'
import { useSession } from '../state/session'
import styles from './AddSavings.module.css'
import { readSavings } from './SavingsField'

/**
 * A small form in the Emergency savings row of the ledger, for a file whose savings were not
 * entered. The amount is in the display currency. Valid input goes to the session's file and
 * the score is worked out again; nothing is stored. The form is replaced by the scored row
 * once it works, so it is submitted, not applied key by key.
 */
export function AddSavings() {
  const intl = useIntl()
  const { currency } = usePrefs()
  const { setUploadSavings } = useSession()
  const inputId = useId()
  const errorId = useId()
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const savings = readSavings(text)
    // Empty is not an amount either: the visitor pressed the button to give one.
    if (savings.kind !== 'amount') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setUploadSavings({ amount: savings.amount, currency })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={inputId} className={styles.label}>
        <FormattedMessage id="score.savings.label" />
      </label>
      <div className={styles.row}>
        <span className={styles.unit} aria-hidden="true">
          {currency}
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          className={styles.input}
          value={text}
          aria-label={`${intl.formatMessage({ id: 'score.savings.label' })} (${currency})`}
          aria-describedby={invalid ? errorId : undefined}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="submit" className={styles.button}>
          <FormattedMessage id="score.savings.submit" />
        </button>
      </div>
      {invalid && (
        <p id={errorId} className={styles.problem}>
          <FormattedMessage id="score.savings.invalid" />
        </p>
      )}
    </form>
  )
}
