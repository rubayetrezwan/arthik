import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMatch } from 'react-router'
import { PERSON_IDS, SAMPLES } from '../data/samples'
import type { CategoryId, Dataset, PersonId } from '../domain/types'

// What the visitor is doing in this visit: the file they brought, and the categories they
// corrected. It lives in memory only. Nothing here is ever written to storage, so
// refreshing the page clears it (spec 8).
//
// The provider sits above the router and the language provider, so changing the language
// or the currency, or reading another page, never loses an upload (Review Focus 5).

export type DatasetKey = PersonId | 'mine'

type Overrides = Record<string, CategoryId>

/** The dataset last shown on a score page, with the category changes made to it. */
interface Active {
  key: DatasetKey
  overrides: Overrides
}

interface SessionState {
  upload: Dataset | null
  setUpload(d: Dataset | null): void
  active: Active | null
  show(key: DatasetKey): void
  edit(key: DatasetKey, txId: string, c: CategoryId): void
}

export interface Session {
  upload: Dataset | null
  setUpload(d: Dataset | null): void
  /** The category changes made to the dataset on screen. */
  overrides: Overrides
  /** Changes one transaction's category in the dataset on screen. */
  overrideCategory(txId: string, c: CategoryId): void
  /** The dataset shown last, kept while the visitor reads other pages. */
  activeKey: DatasetKey | null
}

const NO_OVERRIDES: Overrides = Object.freeze({}) as Overrides

const SessionContext = createContext<SessionState | null>(null)

export function isDatasetKey(value: string): value is DatasetKey {
  return value === 'mine' || (PERSON_IDS as readonly string[]).includes(value)
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [upload, setUploadState] = useState<Dataset | null>(null)
  const [active, setActive] = useState<Active | null>(null)

  const setUpload = useCallback((d: Dataset | null) => {
    setUploadState(d)
    // Changes made to the previous file mean nothing for the new one.
    setActive((current) => (current?.key === 'mine' ? null : current))
  }, [])

  const show = useCallback((key: DatasetKey) => {
    setActive((current) => (current?.key === key ? current : { key, overrides: {} }))
  }, [])

  const edit = useCallback((key: DatasetKey, txId: string, c: CategoryId) => {
    setActive((current) => ({
      key,
      overrides: { ...(current?.key === key ? current.overrides : {}), [txId]: c },
    }))
  }, [])

  const state = useMemo(
    () => ({ upload, setUpload, active, show, edit }),
    [upload, setUpload, active, show, edit],
  )

  return <SessionContext value={state}>{children}</SessionContext>
}

function useSessionState(): SessionState {
  const state = useContext(SessionContext)
  if (!state) throw new Error('useSession must be used inside a SessionProvider')
  return state
}

/** The dataset the current route shows, if it is a score page for one that can exist. */
export function useRouteDatasetKey(): DatasetKey | null {
  const person = useMatch('/score/:person')?.params.person
  return person !== undefined && isDatasetKey(person) ? person : null
}

export function useSession(): Session {
  const { upload, setUpload, active, edit } = useSessionState()
  const key = useRouteDatasetKey()

  const overrideCategory = useCallback(
    (txId: string, c: CategoryId) => {
      if (key) edit(key, txId, c)
    },
    [key, edit],
  )

  return {
    upload,
    setUpload,
    overrides: key !== null && active?.key === key ? active.overrides : NO_OVERRIDES,
    overrideCategory,
    activeKey: active?.key ?? null,
  }
}

function withOverrides(dataset: Dataset, overrides: Overrides): Dataset {
  if (Object.keys(overrides).length === 0) return dataset
  return {
    ...dataset,
    transactions: dataset.transactions.map((tx) => {
      const category = overrides[tx.id]
      if (category === undefined) return tx
      const reviewed = { ...tx, category }
      // The visitor has looked at this one, so it no longer needs a "check it" flag (R9).
      delete reviewed.unrecognisedIncome
      return reviewed
    }),
  }
}

/**
 * The dataset the current route shows, with the visitor's category changes applied: a
 * sample person, the visitor's own file, or null on any other page.
 *
 * Showing a different dataset forgets the changes made to the previous one. Reading a
 * page in between (How the score works, say) does not.
 */
export function useActiveDataset(): Dataset | null {
  const { upload, show } = useSessionState()
  const { overrides } = useSession()
  const key = useRouteDatasetKey()

  useEffect(() => {
    if (key) show(key)
  }, [key, show])

  const base = key === null ? null : key === 'mine' ? upload : SAMPLES[key]
  return useMemo(() => base && withOverrides(base, overrides), [base, overrides])
}
