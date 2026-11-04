import { useIntl } from 'react-intl'
import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from '../domain/types'
import { usePrefs } from '../state/prefs'
import { SelectField } from './SelectField'

/** The sign shown before each code, as in the mockup. CHF has no sign of its own. */
const SIGNS: Record<CurrencyCode, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  GBP: '£',
  CNY: '¥',
  CHF: '',
  AUD: 'A$',
  CAD: 'C$',
  HKD: 'HK$',
  SGD: 'S$',
}

export function CurrencySelect() {
  const { currency, setCurrency } = usePrefs()
  const intl = useIntl()

  return (
    <SelectField
      label={intl.formatMessage({ id: 'currency.label' })}
      value={currency}
      onChange={(event) => {
        const chosen = event.target.value
        if (isCurrencyCode(chosen)) setCurrency(chosen)
      }}
    >
      {CURRENCY_CODES.map((code) => (
        <option key={code} value={code}>
          {SIGNS[code] ? `${SIGNS[code]} ${code}` : code}
        </option>
      ))}
    </SelectField>
  )
}
