import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { categoriesFor, CATEGORIES } from '../domain/categories'
import { I18nProvider } from '../i18n/I18nProvider'
import en from '../i18n/messages/en.json'
import { PrefsProvider } from '../state/prefs'
import { CategorySelect } from './CategorySelect'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
})

const messages: Record<string, string> = en

function renderSelect(props: Partial<Parameters<typeof CategorySelect>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <PrefsProvider>
      <I18nProvider>
        <CategorySelect
          value="eating_out"
          direction="out"
          label="Category for Foodpanda order"
          onChange={onChange}
          {...props}
        />
      </I18nProvider>
    </PrefsProvider>,
  )
  return { onChange, select: screen.getByRole('combobox', { name: 'Category for Foodpanda order' }) }
}

/** The option values in the order they are offered. */
function offered(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => (option as HTMLOptionElement).value)
}

describe('CategorySelect', () => {
  it('has a name for every category, in English', () => {
    for (const { id } of CATEGORIES) expect(messages[`category.${id}`], id).toBeTruthy()
  })

  it('shows the current category by its name', () => {
    const { select } = renderSelect()

    expect(select).toHaveValue('eating_out')
    expect(within(select).getByRole('option', { selected: true })).toHaveTextContent(
      'Eating out & delivery',
    )
  })

  it('offers only the categories that fit money going out, in the table order', () => {
    const { select } = renderSelect()

    expect(offered(select)).toEqual(categoriesFor('out'))
    expect(offered(select)).not.toContain('salary')
  })

  it('offers only the categories that fit money coming in', () => {
    const { select } = renderSelect({ value: 'other_income', direction: 'in' })

    expect(offered(select)).toEqual(categoriesFor('in'))
    expect(offered(select)).not.toContain('eating_out')
  })

  it('groups the categories by how the score treats them', () => {
    const { select } = renderSelect({ value: 'other_income', direction: 'in' })

    const groups = select.querySelectorAll('optgroup')
    expect([...groups].map((group) => group.label)).toEqual(['Income', 'Refunds', 'Not counted'])
    expect(within(groups[2] as HTMLElement).getAllByRole('option').map((o) => o.textContent))
      .toEqual(['Own-account transfer', 'Cash deposit', 'Savings withdrawal', 'Loan received'])
  })

  it('reports the category chosen', async () => {
    const user = userEvent.setup()
    const { select, onChange } = renderSelect()

    await user.selectOptions(select, 'Groceries')

    expect(onChange).toHaveBeenCalledExactlyOnceWith('groceries')
  })

  it('can point to text that describes it', () => {
    const { select } = renderSelect({ describedBy: 'flag-1' })

    expect(select).toHaveAttribute('aria-describedby', 'flag-1')
  })
})
