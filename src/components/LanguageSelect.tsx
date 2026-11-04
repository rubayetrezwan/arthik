import { useIntl } from 'react-intl'
import { isLocaleCode, LOCALE_CODES, LOCALES } from '../i18n/locales'
import { usePrefs } from '../state/prefs'
import { SelectField } from './SelectField'

/**
 * Each language is offered by its own name, in its own script. The select shows the
 * language asked for at once, while its text is still loading.
 */
export function LanguageSelect() {
  const { locale, setLocale } = usePrefs()
  const intl = useIntl()

  return (
    <SelectField
      label={intl.formatMessage({ id: 'language.label' })}
      value={locale}
      onChange={(event) => {
        const chosen = event.target.value
        if (isLocaleCode(chosen)) setLocale(chosen)
      }}
    >
      {LOCALE_CODES.map((l) => (
        <option key={l} value={l} lang={LOCALES[l].intl}>
          {LOCALES[l].nativeName}
        </option>
      ))}
    </SelectField>
  )
}
