import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useNavigate } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { SAMPLES } from '../data/samples'
import type { Dataset } from '../domain/types'
import { SessionProvider, useActiveDataset, useSession } from './session'

const upload: Dataset = {
  key: 'mine',
  emergencySavings: null,
  transactions: [
    {
      id: 'row-2',
      date: '2026-10-01',
      description: 'Transfer from Karim',
      amount: 5000,
      currency: 'BDT',
      category: 'other_income',
      unrecognisedIncome: true,
    },
    {
      id: 'row-3',
      date: '2026-10-02',
      description: 'Shwapno',
      amount: -1200,
      currency: 'BDT',
      category: 'groceries',
    },
  ],
}

const anotherUpload: Dataset = { ...upload, transactions: [...upload.transactions] }

// What the probe saw on its last render, for the tests to read and drive.
const seen = {} as {
  session: ReturnType<typeof useSession>
  dataset: Dataset | null
  go: (path: string) => void
}

function Probe() {
  const session = useSession()
  const dataset = useActiveDataset()
  const navigate = useNavigate()
  useEffect(() => {
    seen.session = session
    seen.dataset = dataset
    seen.go = (path) => {
      void navigate(path)
    }
  })
  return <p>{dataset ? `showing ${dataset.key}` : 'showing nothing'}</p>
}

function renderAt(path: string) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <Probe />
      </MemoryRouter>
    </SessionProvider>,
  )
}

function navigateTo(path: string) {
  act(() => seen.go(path))
}

describe('useActiveDataset', () => {
  it('gives the sample person the route names', () => {
    renderAt('/score/nusrat')

    expect(seen.dataset).toBe(SAMPLES.nusrat)
  })

  it('gives nothing on a page that is not a score page', () => {
    renderAt('/')

    expect(seen.dataset).toBeNull()
  })

  it('gives nothing for a person who does not exist', () => {
    renderAt('/score/someone')

    expect(seen.dataset).toBeNull()
  })

  it('gives the visitor their own transactions once they are in', () => {
    renderAt('/score/mine')
    expect(seen.dataset).toBeNull()

    act(() => seen.session.setUpload(upload))

    expect(seen.dataset).toBe(upload)
  })
})

describe('category changes', () => {
  it('change the one transaction and leave the rest alone', () => {
    renderAt('/score/nusrat')
    const [first, second] = SAMPLES.nusrat.transactions

    act(() => seen.session.overrideCategory(first!.id, 'gifts'))

    expect(seen.session.overrides).toEqual({ [first!.id]: 'gifts' })
    expect(seen.dataset?.transactions[0]).toEqual({ ...first, category: 'gifts' })
    expect(seen.dataset?.transactions[1]).toBe(second)
    // The sample itself is never edited.
    expect(SAMPLES.nusrat.transactions[0]).toBe(first)
  })

  it('clear the "not recognised" flag on money in the visitor has looked at (R9)', () => {
    renderAt('/score/mine')
    act(() => seen.session.setUpload(upload))

    act(() => seen.session.overrideCategory('row-2', 'family_support_in'))

    const changed = seen.dataset?.transactions[0]
    expect(changed?.category).toBe('family_support_in')
    expect(changed).not.toHaveProperty('unrecognisedIncome')
  })

  it('are forgotten when another dataset is shown, even after coming back', () => {
    renderAt('/score/nusrat')
    const first = SAMPLES.nusrat.transactions[0]!
    act(() => seen.session.overrideCategory(first.id, 'gifts'))

    navigateTo('/score/tanvir')
    expect(seen.session.overrides).toEqual({})
    expect(seen.dataset).toBe(SAMPLES.tanvir)

    navigateTo('/score/nusrat')
    expect(seen.session.overrides).toEqual({})
    expect(seen.dataset).toBe(SAMPLES.nusrat)
  })

  it('are kept while the visitor reads another page and comes back', () => {
    renderAt('/score/nusrat')
    const first = SAMPLES.nusrat.transactions[0]!
    act(() => seen.session.overrideCategory(first.id, 'gifts'))

    navigateTo('/how-it-works')
    navigateTo('/score/nusrat')

    expect(seen.dataset?.transactions[0]?.category).toBe('gifts')
  })

  it('are forgotten when a new file comes in', () => {
    renderAt('/score/mine')
    act(() => seen.session.setUpload(upload))
    act(() => seen.session.overrideCategory('row-3', 'eating_out'))

    act(() => seen.session.setUpload(anotherUpload))

    expect(seen.session.overrides).toEqual({})
    expect(seen.dataset).toBe(anotherUpload)
  })

  it('keep the same dataset object until something changes, so scores can be memoised', () => {
    const { rerender } = renderAt('/score/mine')
    act(() => seen.session.setUpload(upload))
    act(() => seen.session.overrideCategory('row-3', 'eating_out'))
    const before = seen.dataset

    rerender(
      <SessionProvider>
        <MemoryRouter initialEntries={['/score/mine']}>
          <Probe />
        </MemoryRouter>
      </SessionProvider>,
    )

    expect(seen.dataset).toBe(before)
  })
})

describe('the session', () => {
  it('remembers which dataset was shown last', () => {
    renderAt('/score/arif')

    navigateTo('/about')

    expect(seen.session.activeKey).toBe('arif')
    expect(screen.getByText('showing nothing')).toBeInTheDocument()
  })

  it('says so when it is used outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    function Lonely() {
      useSession()
      return null
    }

    expect(() =>
      render(
        <MemoryRouter>
          <Lonely />
        </MemoryRouter>,
      ),
    ).toThrow(/SessionProvider/)
    vi.restoreAllMocks()
  })
})
