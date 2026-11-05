import { describe, expect, it } from 'vitest'
import { getLoadedSample, loadSample } from './loadSamples'
import { PERSON_IDS } from './people'

// This file never imports ./index, so nothing has been handed to the loader in advance:
// these tests run the real, lazy path.
describe('loadSample', () => {
  it('has nothing loaded until a person is asked for', () => {
    expect(getLoadedSample('tanvir')).toBeUndefined()
  })

  it('loads and checks a person once, and hands back the same object after that', async () => {
    const first = await loadSample('tanvir')

    expect(first.key).toBe('tanvir')
    expect(first.transactions.length).toBeGreaterThan(0)
    expect(getLoadedSample('tanvir')).toBe(first)
    expect(await loadSample('tanvir')).toBe(first)
  })

  it('loads the person whose summary compares with Nusrat together with Nusrat', async () => {
    await loadSample('farhana')

    expect(getLoadedSample('nusrat')).toBeDefined()
  })

  it('can load every person in the list', async () => {
    const all = await Promise.all(PERSON_IDS.map(loadSample))

    expect(all.map((dataset) => dataset.key)).toEqual([...PERSON_IDS])
  })
})
