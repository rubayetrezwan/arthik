import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFonts } from './fonts'
import { loadMessages } from './loadMessages'
import en from './messages/en.json'
import { prepareFirstPaint } from './startup'

vi.mock('./fonts', () => ({ loadFonts: vi.fn() }))
vi.mock('./loadMessages', () => ({ loadMessages: vi.fn() }))

const html = document.documentElement
const arabic = { ...en, 'app.name': 'أرثيك' }

function never<T>(): Promise<T> {
  return new Promise<T>(() => {})
}

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
  vi.mocked(loadFonts).mockResolvedValue(undefined)
  vi.mocked(loadMessages).mockResolvedValue(arabic)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.mocked(loadFonts).mockReset()
  vi.mocked(loadMessages).mockReset()
})

describe('prepareFirstPaint', () => {
  it('does not hold up English, which is bundled, but starts on its fonts', async () => {
    vi.mocked(loadFonts).mockReturnValue(never())

    await expect(prepareFirstPaint()).resolves.toBeUndefined()

    expect(loadFonts).toHaveBeenCalledWith('en')
    expect(loadMessages).not.toHaveBeenCalled()
    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')
  })

  it('sets the page language and direction for a returning visitor before anything loads', () => {
    localStorage.setItem('arthik.locale', 'ar')
    vi.mocked(loadMessages).mockReturnValue(never())

    void prepareFirstPaint()

    expect(html.lang).toBe('ar')
    expect(html.dir).toBe('rtl')
  })

  it("waits for a returning visitor's messages and fonts, and hands the messages over", async () => {
    localStorage.setItem('arthik.locale', 'ar')

    const preloaded = await prepareFirstPaint()

    expect(preloaded).toEqual({ locale: 'ar', messages: arabic })
    expect(loadMessages).toHaveBeenCalledWith('ar')
    expect(loadFonts).toHaveBeenCalledWith('ar')
  })

  it('reads the language the same way the preferences do', async () => {
    localStorage.setItem('arthik.locale', 'klingon')

    await expect(prepareFirstPaint()).resolves.toBeUndefined()
    expect(html.lang).toBe('en')
  })

  it('draws the page in English rather than leave it blank when loading stalls', async () => {
    vi.useFakeTimers()
    localStorage.setItem('arthik.locale', 'ar')
    vi.mocked(loadFonts).mockReturnValue(never())

    const result = prepareFirstPaint({ waitAtMostMs: 4000 })
    await vi.advanceTimersByTimeAsync(4000)

    await expect(result).resolves.toBeUndefined()
    // English text must not sit in a right-to-left page while Arabic loads.
    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')
  })

  it('draws the page in English if loading a language ever fails', async () => {
    localStorage.setItem('arthik.locale', 'ar')
    vi.mocked(loadMessages).mockRejectedValue(new Error('chunk failed'))

    await expect(prepareFirstPaint()).resolves.toBeUndefined()

    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')
  })

  it('opens in English, without logging, when the browser blocks storage (Review Focus 4)', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Storage is blocked', 'SecurityError')
    })
    const error = vi.spyOn(console, 'error')

    await expect(prepareFirstPaint()).resolves.toBeUndefined()

    expect(html.lang).toBe('en')
    expect(html.dir).toBe('ltr')
    expect(loadMessages).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
