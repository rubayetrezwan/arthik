import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLES } from '../data/samples'
import { summaryValues } from '../data/samples/summaryValues'
import { computeMeasures } from '../domain/measures'
import en from '../i18n/messages/en.json'
import { renderApp } from '../test/renderApp'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

const messages: Record<string, string> = en

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en'
  document.documentElement.dir = 'ltr'
  vi.spyOn(console, 'error')
})

afterEach(() => {
  expect(console.error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

function main() {
  return within(screen.getByRole('main'))
}

function section(name: string): HTMLElement {
  const found = main().getByRole('heading', { level: 2, name }).closest('section')
  if (!found) throw new Error(`no section for ${name}`)
  return found
}

describe('AboutPage', () => {
  it('has exactly one h1, and headings that never skip a level', () => {
    renderApp('/about')

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent('About Arthik')
    const levels = [...screen.getByRole('main').querySelectorAll('h1, h2, h3, h4, h5, h6')].map(
      (heading) => Number(heading.tagName.slice(1)),
    )
    expect(levels[0]).toBe(1)
    levels.slice(1).forEach((level, index) => {
      expect(level).toBeLessThanOrEqual((levels[index] ?? 0) + 1)
      expect(level).toBeGreaterThan(1)
    })
    expect(
      main()
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(['Why it was made', 'Who made it', 'What Arthik is not', 'Source code'])
  })

  it('says why it was made: financial inclusion, and habits rather than income', () => {
    renderApp('/about')

    const why = section('Why it was made')
    expect(why).toHaveTextContent('financial inclusion')
    expect(why).toHaveTextContent('The score measures habits, not income.')
  })

  it('makes the habits point with figures worked out from the sample people', () => {
    renderApp('/about')

    const farhana = summaryValues('farhana', computeMeasures(SAMPLES.farhana), 'en')
    const rahim = summaryValues('rahim', computeMeasures(SAMPLES.rahim), 'en')
    expect(section('Why it was made')).toHaveTextContent(
      `Farhana earns nearly ${farhana.incomeMultiple} times what Nusrat has coming in, yet scores lowest. Rahim sends about ${rahim.sentHomeShare} of his pay home every month and still scores highest.`,
    )
  })

  it('says who made it, that it was built with Claude Code, and where AI was and was not used', () => {
    renderApp('/about')

    const who = section('Who made it')
    expect(who).toHaveTextContent('Arthik was made by Rubayet Rezwan.')
    expect(who).toHaveTextContent('It was built with Claude Code.')
    expect(who).toHaveTextContent('The score never comes from AI.')
    expect(who).toHaveTextContent('summaries of the sample people were written with Claude')
    expect(who).toHaveTextContent('The translations are AI-assisted.')
    expect(within(who).getByRole('link', { name: 'How the score works' })).toHaveAttribute(
      'href',
      '#/how-it-works',
    )
  })

  it('gives the disclaimer word for word', () => {
    renderApp('/about')

    expect(section('What Arthik is not')).toHaveTextContent(
      'Arthik is an educational tool. It is not financial advice and not a credit score. Your data stays in your browser and is never uploaded.',
    )
  })

  it('links to the source code', () => {
    renderApp('/about')

    expect(within(section('Source code')).getByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/rubayetrezwan/arthik',
    )
  })
})

describe('the About copy', () => {
  it('never types a digit', () => {
    const typed = Object.entries(messages).filter(
      ([key, text]) => key.startsWith('about.') && /\p{Nd}/u.test(text),
    )
    expect(typed).toEqual([])
  })
})
