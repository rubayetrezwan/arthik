import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeGet, safeSet } from './storage'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function blocked(): never {
  throw new DOMException('Storage is blocked', 'SecurityError')
}

describe('safeGet and safeSet', () => {
  it('store and read a value', () => {
    safeSet('arthik.test', 'ar')

    expect(safeGet('arthik.test')).toBe('ar')
    expect(localStorage.getItem('arthik.test')).toBe('ar')
  })

  it('read null for a key that was never set', () => {
    expect(safeGet('arthik.missing')).toBeNull()
  })

  it('do not throw or log when reading and writing throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)
    const error = vi.spyOn(console, 'error')
    const warn = vi.spyOn(console, 'warn')

    expect(() => safeSet('arthik.test', 'ar')).not.toThrow()
    expect(safeGet('arthik.test')).toBeNull()
    expect(error).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('do not throw when the localStorage property itself throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked)

    expect(() => safeSet('arthik.test', 'ar')).not.toThrow()
    expect(safeGet('arthik.test')).toBeNull()
  })

  it('do not throw when the storage is full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(() => safeSet('arthik.test', 'ar')).not.toThrow()
  })
})
