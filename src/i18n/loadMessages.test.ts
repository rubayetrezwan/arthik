import { describe, expect, it } from 'vitest'
import { createMessageLoader } from './loadMessages'
import en from './messages/en.json'

describe('createMessageLoader', () => {
  it('returns the bundled English messages for English', async () => {
    const load = createMessageLoader({})

    expect(await load('en')).toEqual(en)
  })

  it('never reads a file for English, even if one is listed', async () => {
    const load = createMessageLoader({
      './messages/en.json': () => Promise.reject(new Error('should not be read')),
    })

    expect(await load('en')).toEqual(en)
  })

  it('falls back to English when a language has no message file yet', async () => {
    const load = createMessageLoader({})

    expect(await load('ar')).toEqual(en)
  })

  it('uses the language file when there is one', async () => {
    const load = createMessageLoader({
      './messages/bn.json': () => Promise.resolve({ 'app.name': 'আর্থিক' }),
    })

    const messages = await load('bn')

    expect(messages['app.name']).toBe('আর্থিক')
  })

  it('fills any key the language file does not have from English', async () => {
    const load = createMessageLoader({
      './messages/fr.json': () => Promise.resolve({ 'app.name': 'Arthik FR' }),
    })

    const messages = await load('fr')

    expect(messages['app.name']).toBe('Arthik FR')
    expect(messages['nav.home']).toBe(en['nav.home'])
  })

  it('falls back to English when the file cannot be loaded', async () => {
    const load = createMessageLoader({
      './messages/es.json': () => Promise.reject(new Error('chunk failed')),
    })

    expect(await load('es')).toEqual(en)
  })
})
