import { useIntl } from 'react-intl'
import { usePrefs } from '../state/prefs'
import { isThemeChoice, THEME_CHOICES } from '../state/theme'
import { SelectField } from './SelectField'
import styles from './ThemeSelect.module.css'

/** Light paper, dark paper, or whatever the device is set to (the default). */
export function ThemeSelect() {
  const { theme, setTheme } = usePrefs()
  const intl = useIntl()

  return (
    <SelectField
      label={intl.formatMessage({ id: 'theme.label' })}
      fieldClassName={styles.field}
      value={theme}
      onChange={(event) => {
        const chosen = event.target.value
        if (isThemeChoice(chosen)) setTheme(chosen)
      }}
    >
      {THEME_CHOICES.map((choice) => (
        <option key={choice} value={choice}>
          {intl.formatMessage({ id: `theme.${choice}` })}
        </option>
      ))}
    </SelectField>
  )
}
