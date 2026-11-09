import { describe, expect, it } from 'vitest'
import indexHtml from '../index.html?raw'

const TITLE = 'Arthik: a financial health score where every point is explained'
const DESCRIPTION =
  'Free, private, built for Bangladesh. Upload bank or mobile-wallet transactions and get a 0–100 score from published formulas, not AI.'
const IMAGE = 'https://rubayetrezwan.github.io/arthik/og-image.png'

function meta(attribute: 'name' | 'property', key: string): string | undefined {
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')
  return document.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content') ?? undefined
}

describe('index.html: how a shared link looks (R58)', () => {
  it('has a title and a description that say what Arthik is', () => {
    const document = new DOMParser().parseFromString(indexHtml, 'text/html')
    expect(document.title).toBe(TITLE)
    expect(meta('name', 'description')).toBe(DESCRIPTION)
  })

  it('has the Open Graph tags, with absolute URLs', () => {
    expect(meta('property', 'og:title')).toBe(TITLE)
    expect(meta('property', 'og:description')).toBe(DESCRIPTION)
    expect(meta('property', 'og:type')).toBe('website')
    expect(meta('property', 'og:url')).toBe('https://rubayetrezwan.github.io/arthik/')
    expect(meta('property', 'og:image')).toBe(IMAGE)
  })

  it('asks for a large image card on Twitter', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
  })
})
