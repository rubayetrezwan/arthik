import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { useEffect } from 'react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import template from '../../public/arthik-template.csv?raw'
import { CSV_EXAMPLES } from '../components/csvExamples'
import { MAX_ROWS, parseTransactionsCsv, type CsvErrorCode } from '../domain/csv'
import { parseAmount, readDateCell } from '../domain/csvCells'
import { isCurrencyCode } from '../domain/types'
import { I18nProvider } from '../i18n/I18nProvider'
import { routes } from '../routes'
import { PrefsProvider } from '../state/prefs'
import { SessionProvider, useSession, type Session } from '../state/session'

vi.mock('../i18n/fonts', () => ({ loadFonts: vi.fn(() => Promise.resolve()) }))

// Counted, to show a file that is too large is never read.
vi.mock('../domain/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/csv')>()
  return { ...actual, parseTransactionsCsv: vi.fn(actual.parseTransactionsCsv) }
})

const html = document.documentElement

beforeEach(() => {
  localStorage.clear()
  html.lang = 'en'
  html.dir = 'ltr'
  vi.mocked(parseTransactionsCsv).mockClear()
  vi.spyOn(console, 'error')
})

afterEach(() => {
  // A missing message or placeholder value is reported here by react-intl.
  expect(console.error).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

/** The session as the app last rendered it, for the test to read and to act on. */
const seen: { session: Session | null } = { session: null }

function Probe() {
  const session = useSession()
  useEffect(() => {
    seen.session = session
  })
  return <Outlet />
}

function session(): Session {
  if (!seen.session) throw new Error('The app has not rendered yet')
  return seen.session
}

/** The app at /upload, with a memory router the test can look at. */
function renderUpload() {
  seen.session = null
  const router = createMemoryRouter([{ element: <Probe />, children: routes }], {
    initialEntries: ['/upload'],
  })
  render(
    <PrefsProvider>
      <SessionProvider>
        <I18nProvider>
          <RouterProvider router={router} />
        </I18nProvider>
      </SessionProvider>
    </PrefsProvider>,
  )
  return { router, user: userEvent.setup() }
}

function main() {
  return within(screen.getByRole('main'))
}

function csv(text: string, name = 'statement.csv'): File {
  return new File([text], name, { type: 'text/csv' })
}

function lines(...rows: string[]): string {
  return rows.join('\n')
}

/** The one element whose whole text is `text`, whatever elements the text is split across. */
function byText(text: string): HTMLElement {
  return main().getByText(
    (_, element) =>
      element !== null &&
      element.textContent === text &&
      !Array.from(element.children).some((child) => child.textContent === text),
  )
}

function fileInput(): HTMLInputElement {
  return main().getByLabelText('Choose a CSV file')
}

async function choose(user: UserEvent, file: File) {
  await user.upload(fileInput(), file)
}

async function submit(user: UserEvent) {
  await user.click(main().getByRole('button', { name: 'See your score' }))
}

/** The problems listed in the summary, as read. */
function listed(): string[] {
  const summary = main().getByRole('alert', { name: /^Arthik couldn’t read/ })
  return within(summary)
    .queryAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

const TEMPLATE_ROWS = parseTransactionsCsv(template, 'BDT').transactions.length

/** The template with the dates of its rows 5 and 9 (as a spreadsheet numbers them) broken. */
function templateWithTwoBadRows(): string {
  const rows = template.trimEnd().split('\n')
  rows[4] = rows[4]!.replace(/^[^,]+/, '2026-08-32')
  rows[8] = rows[8]!.replace(/,-?\d+(?:\.\d+)?,/, ',12;50,')
  return lines(...rows)
}

describe('UploadPage: the page', () => {
  it('has one heading, the privacy line and the template to download', () => {
    renderUpload()

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(main().getByRole('heading', { level: 1 })).toHaveTextContent(
      'Use your own transactions',
    )
    expect(main().getByText('Your file never leaves this browser.')).toBeInTheDocument()
    expect(
      main().getByText(
        'Arthik reads it on this device and saves nothing, so refreshing the page clears it.',
      ),
    ).toBeInTheDocument()
    const link = main().getByRole('link', { name: 'Download the template' })
    expect(link).toHaveAttribute('href', `${import.meta.env.BASE_URL}arthik-template.csv`)
    expect(link).toHaveAttribute('download')
  })

  it('explains the columns, the date formats and the credit card rule', () => {
    renderUpload()

    const help = within(main().getByRole('region', { name: 'What the file needs' }))
    for (const column of ['date', 'description', 'amount', 'currency', 'category']) {
      expect(help.getByText(column, { selector: 'dt code' })).toBeInTheDocument()
    }
    expect(help.getByText(/^The day of the transaction/)).toHaveTextContent(
      'The day of the transaction, as 2026-10-31 or day first, as 31/10/2026. A time after the date is ignored.',
    )
    expect(help.getByText(/^In place of/)).toHaveTextContent(
      'In place of amount, the file can have a debit column for money out and a credit column for money in, or withdrawal and deposit.',
    )
    expect(help.getByRole('heading', { name: 'Paying off a credit card' })).toBeInTheDocument()
    expect(
      help.getByText(
        'A credit card bill payment counts towards your Debt payments. If your file also has the card’s own purchases, give the bill payment the category Own-account transfer, so the same spending isn’t counted twice.',
      ),
    ).toBeInTheDocument()
  })

  it('gives examples that the reader takes as it says', () => {
    expect(readDateCell(CSV_EXAMPLES.isoDate).date).toBe('2026-10-31')
    expect(readDateCell(CSV_EXAMPLES.dayFirstDate).date).toBe('2026-10-31')
    expect(readDateCell(CSV_EXAMPLES.monthFirstDate).monthFirstOnly).toBe(true)
    expect(parseAmount(CSV_EXAMPLES.moneyIn)).toBeGreaterThan(0)
    expect(parseAmount(CSV_EXAMPLES.moneyOut)).toBeLessThan(0)
    expect(isCurrencyCode(CSV_EXAMPLES.currency)).toBe(true)
  })

  it('labels the savings field and says which currency it takes', () => {
    renderUpload()

    const savings = main().getByLabelText('Emergency savings (optional)')
    expect(savings).toHaveAccessibleDescription(
      'Money you could use in an emergency, such as savings in a bank account or mobile wallet, in BDT. If you leave it empty, Emergency savings isn’t scored.',
    )
  })
})

describe('UploadPage: a file Arthik can read', () => {
  it('uploading the template shows your score', async () => {
    const { router, user } = renderUpload()

    await choose(user, csv(template, 'arthik-template.csv'))
    expect(byText('Chosen: arthik-template.csv')).toBeInTheDocument()
    await submit(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(await main().findByTestId('score')).toBeInTheDocument()
    expect(session().upload).toMatchObject({ key: 'mine', emergencySavings: null })
    expect(session().upload?.transactions).toHaveLength(TEMPLATE_ROWS)
  })

  it('takes a file dropped on the box the same way', async () => {
    const { router, user } = renderUpload()

    fireEvent.drop(main().getByText('or drag it here'), {
      dataTransfer: { files: [csv(template)], types: ['Files'] },
    })
    await submit(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.transactions).toHaveLength(TEMPLATE_ROWS)
  })

  it('reads a bank export with a BOM, semicolons, debit and credit columns and Bengali digits', async () => {
    const { router, user } = renderUpload()

    await choose(
      user,
      csv(
        lines(
          '\u{FEFF}Date;Description;Withdrawal;Deposit;Balance',
          '01/10/2026;Salary credit;;৫৫,০০০.০০;55000',
          '02/10/2026;House rent;18,000.00;-;37000',
          '03/10/2026;Shwapno;1 250.50;;35749.50',
        ),
      ),
    )
    await submit(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.transactions.map((t) => [t.date, t.amount])).toEqual([
      ['2026-10-01', 55000],
      ['2026-10-02', -18000],
      ['2026-10-03', -1250.5],
    ])
  })

  it('passes the savings to the session in the currency chosen', async () => {
    const { router, user } = renderUpload()

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    expect(main().getByLabelText('Emergency savings (optional)')).toHaveAccessibleDescription(
      /, in USD\./,
    )
    await user.type(main().getByLabelText('Emergency savings (optional)'), '1,500.50')
    await choose(user, csv(template))
    await submit(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.emergencySavings).toEqual({ amount: 1500.5, currency: 'USD' })
  })

  it.each([
    ['1,50,000', 150000],
    ['৫০,০০০', 50000],
    ['0', 0],
    ['  2500  ', 2500],
  ])('reads savings written as %j', async (typed, amount) => {
    const { router, user } = renderUpload()

    await user.type(main().getByLabelText('Emergency savings (optional)'), typed)
    await choose(user, csv(template))
    await submit(user)

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.emergencySavings).toEqual({ amount, currency: 'BDT' })
  })

  it('says so when every amount in the file is zero', async () => {
    const { router, user } = renderUpload()

    await choose(user, csv(lines('date,description,amount', '2026-10-01,Balance enquiry,0')))
    await submit(user)

    await waitFor(() =>
      expect(
        byText('Every amount in “statement.csv” is zero, so there’s nothing to score.'),
      ).toBeInTheDocument(),
    )
    expect(router.state.location.pathname).toBe('/upload')
    expect(session().upload).toBeNull()
  })
})

describe('UploadPage: privacy', () => {
  it('writes nothing about the file or the savings to localStorage or sessionStorage', async () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    const { router, user } = renderUpload()

    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.type(main().getByLabelText('Emergency savings (optional)'), '12345')
    await choose(user, csv(templateWithTwoBadRows()))
    await submit(user)
    await user.click(await main().findByRole('button', { name: /^Continue with/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))

    // The one thing kept is the currency the visitor chose, which is a preference.
    expect(writes.mock.calls).toEqual([['arthik.currency', 'GBP']])
    expect(Object.keys(localStorage)).toEqual(['arthik.currency'])
    expect(sessionStorage).toHaveLength(0)
  })
})

describe('UploadPage: savings it cannot read', () => {
  it.each(['-500', 'abc', '12,50', '1.500', 'NaN', 'Infinity', '1e5', '৳500', '(500)', '.5'])(
    'keeps you on the page and says what to enter for %j',
    async (typed) => {
      const { router, user } = renderUpload()

      const savings = main().getByLabelText('Emergency savings (optional)')
      await user.type(savings, typed)
      await choose(user, csv(template))
      await submit(user)

      expect(savings).toHaveAttribute('aria-invalid', 'true')
      expect(savings).toHaveAccessibleDescription(
        expect.stringContaining(
          'Enter the amount in digits, with a point before any decimals, or leave it empty.',
        ),
      )
      expect(savings).toHaveFocus()
      expect(parseTransactionsCsv).not.toHaveBeenCalled()
      expect(router.state.location.pathname).toBe('/upload')
      expect(session().upload).toBeNull()
    },
  )

  it('clears the message once the amount is changed', async () => {
    const { user } = renderUpload()

    const savings = main().getByLabelText('Emergency savings (optional)')
    await user.type(savings, '-5')
    await submit(user)
    await user.clear(savings)

    expect(savings).not.toHaveAttribute('aria-invalid')
    expect(
      main().queryByText(/^Enter the amount in digits/),
    ).not.toBeInTheDocument()
  })
})

describe('UploadPage: the file itself', () => {
  it('a 6 MB file shows the size error and is never read', async () => {
    const { router, user } = renderUpload()

    const big = csv('date,description,amount\n', 'big.csv')
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    const read = vi.spyOn(big, 'text')
    await choose(user, big)

    const problem =
      '“big.csv” is 6 MB, and Arthik can read files of up to 5 MB. Save a shorter period of transactions and try again.'
    expect(byText(problem)).toBeInTheDocument()
    expect(fileInput()).toHaveAttribute('aria-invalid', 'true')
    await submit(user)

    expect(byText(problem)).toBeInTheDocument()
    expect(fileInput()).toHaveFocus()
    expect(read).not.toHaveBeenCalled()
    expect(parseTransactionsCsv).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/upload')
  })

  it('rounds a size just over the limit up, so it never reads as the limit', async () => {
    const { user } = renderUpload()

    const big = csv('x', 'over.csv')
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 })
    await choose(user, big)

    expect(
      byText(
        '“over.csv” is 5.1 MB, and Arthik can read files of up to 5 MB. Save a shorter period of transactions and try again.',
      ),
    ).toBeInTheDocument()
  })

  it('refuses a file that is not a CSV', async () => {
    renderUpload()

    fireEvent.drop(main().getByText('or drag it here'), {
      dataTransfer: { files: [new File(['x'], 'statement.xlsx')], types: ['Files'] },
    })

    expect(
      byText('“statement.xlsx” isn’t a CSV file. Choose a file whose name ends in .csv.'),
    ).toBeInTheDocument()
    expect(parseTransactionsCsv).not.toHaveBeenCalled()
  })

  it('asks for a file when none was chosen', async () => {
    const { user } = renderUpload()

    await submit(user)

    expect(main().getByText('Choose a CSV file first.')).toBeInTheDocument()
    expect(fileInput()).toHaveFocus()
    expect(fileInput()).toHaveAccessibleDescription(expect.stringContaining('Choose a CSV file first.'))
  })

  it('drops what it read from a file once another one has been chosen', async () => {
    const { router, user } = renderUpload()

    const first = csv('', 'first.csv')
    let finishReading: (text: string) => void = () => undefined
    vi.spyOn(first, 'text').mockReturnValue(
      new Promise<string>((resolve) => {
        finishReading = resolve
      }),
    )
    await choose(user, first)
    await submit(user)
    await choose(user, csv(template, 'second.csv'))
    await act(async () => finishReading(lines('date,description,amount', 'someday,x,-5')))

    expect(parseTransactionsCsv).not.toHaveBeenCalled()
    expect(main().queryByRole('alert', { name: /^Arthik couldn’t read/ })).not.toBeInTheDocument()
    expect(byText('Chosen: second.csv')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/upload')
    expect(session().upload).toBeNull()

    await submit(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.transactions).toHaveLength(TEMPLATE_ROWS)
  })

  it('says so when the file cannot be opened', async () => {
    const { user } = renderUpload()

    const gone = csv(template, 'gone.csv')
    vi.spyOn(gone, 'text').mockRejectedValue(new DOMException('gone', 'NotReadableError'))
    await choose(user, gone)
    await submit(user)

    await waitFor(() =>
      expect(byText('“gone.csv” couldn’t be opened. Choose it again.')).toBeInTheDocument(),
    )
    expect(parseTransactionsCsv).not.toHaveBeenCalled()
  })

  it('is a focusable file input, labelled, that offers CSV files and comes before the savings', async () => {
    const { user } = renderUpload()

    fileInput().focus()
    expect(fileInput()).toHaveFocus()
    expect(fileInput()).toHaveAttribute('type', 'file')
    expect(fileInput()).toHaveAttribute('accept', '.csv,text/csv')
    await user.keyboard('{Tab}')
    expect(main().getByLabelText('Emergency savings (optional)')).toHaveFocus()
  })
})

describe('UploadPage: rows with problems', () => {
  it('a file with 2 bad rows shows both row numbers and the continue button', async () => {
    const { router, user } = renderUpload()

    await choose(user, csv(templateWithTwoBadRows()))
    await submit(user)

    const summary = await main().findByRole('alert', { name: 'Arthik couldn’t read all of this file' })
    expect(summary).toHaveFocus()
    expect(listed()).toEqual([
      'Row 5: “2026-08-32” isn’t a date Arthik can read. Write it as 2026-10-31, or day first, as 31/10/2026.',
      'Row 9: “12;50” isn’t an amount Arthik can read. Write it in digits, with a point only before decimals, as in -1250.50.',
    ])
    expect(
      within(summary).getByRole('button', {
        name: `Continue with ${TEMPLATE_ROWS - 2} valid rows`,
      }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/upload')
    expect(session().upload).toBeNull()
  })

  it('continuing uploads only the valid rows, with the savings', async () => {
    const { router, user } = renderUpload()

    await user.type(main().getByLabelText('Emergency savings (optional)'), '30000')
    await choose(user, csv(templateWithTwoBadRows()))
    await submit(user)
    await user.click(await main().findByRole('button', { name: /^Continue with/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    const upload = session().upload
    expect(upload?.transactions).toHaveLength(TEMPLATE_ROWS - 2)
    expect(upload?.transactions.map((t) => t.id)).not.toContain('row-5')
    expect(upload?.transactions.map((t) => t.id)).not.toContain('row-9')
    expect(upload?.emergencySavings).toEqual({ amount: 30000, currency: 'BDT' })
  })

  it('says “row” for a single valid row', async () => {
    const { user } = renderUpload()

    await choose(
      user,
      csv(lines('date,description,amount', '2026-10-01,Salary,55000', 'yesterday,Rent,-500')),
    )
    await submit(user)

    expect(
      await main().findByRole('button', { name: 'Continue with 1 valid row' }),
    ).toBeInTheDocument()
  })

  it('checks the savings again before continuing', async () => {
    const { router, user } = renderUpload()

    await choose(user, csv(templateWithTwoBadRows()))
    await submit(user)
    const savings = main().getByLabelText('Emergency savings (optional)')
    await user.type(savings, '-1')
    await user.click(main().getByRole('button', { name: /^Continue with/ }))

    expect(savings).toHaveFocus()
    expect(savings).toHaveAttribute('aria-invalid', 'true')
    expect(router.state.location.pathname).toBe('/upload')
  })

  it('gives rows without a currency the currency chosen when you continue', async () => {
    const { router, user } = renderUpload()

    await choose(
      user,
      csv(lines('date,description,amount', '2026-10-01,Salary,55000', '2026-10-02,Rent,abc')),
    )
    await submit(user)
    await main().findByRole('alert', { name: /^Arthik couldn’t read/ })
    await user.selectOptions(screen.getByLabelText('Currency'), 'GBP')
    await user.click(main().getByRole('button', { name: 'Continue with 1 valid row' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/score/mine'))
    expect(session().upload?.transactions.map((t) => t.currency)).toEqual(['GBP'])
  })

  it('has no continue button when no row can be read', async () => {
    const { user } = renderUpload()

    await choose(user, csv(lines('date,description,amount,type', '2026-10-01,Rent,500,DR')))
    await submit(user)

    const summary = await main().findByRole('alert', { name: 'Arthik couldn’t read this file' })
    expect(summary).toHaveFocus()
    expect(within(summary).getByText('Fix the file in your spreadsheet and choose it again.'))
      .toBeInTheDocument()
    expect(within(summary).queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows problems with the whole file without a row number', async () => {
    const { user } = renderUpload()

    await choose(user, csv(lines('date,amount', '2026-10-01,-500')))
    await submit(user)

    expect(await main().findByRole('alert', { name: /^Arthik couldn’t read/ })).toBeInTheDocument()
    expect(listed()).toEqual([
      'The file has no description column. Its first row should name the columns, as in the template.',
    ])
  })

  it('clears the problems when another file is chosen', async () => {
    const { user } = renderUpload()

    await choose(user, csv(templateWithTwoBadRows()))
    await submit(user)
    await main().findByRole('alert', { name: /^Arthik couldn’t read/ })
    await choose(user, csv(template))

    expect(main().queryByRole('alert', { name: /^Arthik couldn’t read/ })).not.toBeInTheDocument()
  })

  it('lists the first 20 problems, and the first of any other kind, and counts the rest', async () => {
    const { user } = renderUpload()

    const badDates = Array.from({ length: 25 }, (_, index) => `someday,Shop ${index},-100,`)
    await choose(
      user,
      csv(
        lines(
          'date,description,amount,currency',
          '2026-10-01,Salary,55000,',
          ...badDates,
          '2026-10-02,Shop,-100,TK',
        ),
      ),
    )
    await submit(user)

    await main().findByRole('alert', { name: /^Arthik couldn’t read/ })
    const items = listed()
    expect(items).toHaveLength(21)
    expect(items[0]).toMatch(/^Row 3: “someday”/)
    expect(items[19]).toMatch(/^Row 22: “someday”/)
    expect(items[20]).toMatch(/^Row 28: “TK” isn’t a currency/)
    expect(main().getByText('5 more problems aren’t listed.')).toBeInTheDocument()
  })
})

describe('UploadPage: a message for every problem the reader can find', () => {
  const H = 'date,description,amount'
  const MANY_ROWS = [H, ...Array.from({ length: MAX_ROWS + 1 }, () => '2026-10-01,x,-1')].join('\n')

  // Typed by code, so a new code without a case here does not compile.
  const CASES: Record<CsvErrorCode, [file: string, shown: string][]> = {
    empty_file: [['', 'The file is empty.']],
    no_rows: [[H, 'The file has a header row but no transactions under it.']],
    missing_column: [
      [
        lines('date,amount', '2026-10-01,-5'),
        'The file has no description column. Its first row should name the columns, as in the template.',
      ],
      [
        lines('date,description', '2026-10-01,x'),
        'The file has no amount column, and no debit and credit columns in its place. Its first row should name the columns, as in the template.',
      ],
    ],
    duplicate_column: [
      [
        lines('date,Date,description,amount', '2026-10-01,2026-10-01,x,-5'),
        'The file has more than one date column, so Arthik can’t tell which to read. Keep one of them.',
      ],
      [
        lines('date,description,debit,withdrawal,credit', '2026-10-01,x,5,,'),
        'The file has more than one column for money going out (debit or withdrawal), so Arthik can’t tell which to read. Keep one of them.',
      ],
      [
        lines('date,description,debit,Deposit,credit', '2026-10-01,x,5,,'),
        'The file has more than one column for money coming in (credit or deposit), so Arthik can’t tell which to read. Keep one of them.',
      ],
    ],
    direction_column: [
      [
        lines(`${H},Dr / Cr`, '2026-10-01,x,500,Dr'),
        'The “Dr / Cr” column says whether money went in or out, so Arthik can’t be sure which way each amount went. Make money going out negative in the amount column and delete the “Dr / Cr” column, or use separate debit and credit columns.',
      ],
      [
        lines(`${H},,balance`, '2026-10-01,x,500,DR,900'),
        'A column without a name says whether money went in or out, so Arthik can’t be sure which way each amount went. Make money going out negative in the amount column and delete that column, or use separate debit and credit columns.',
      ],
    ],
    too_many_rows: [
      [
        MANY_ROWS,
        'The file has more than 20,000 rows. Save a shorter period of transactions and try again.',
      ],
    ],
    month_first_dates: [
      [
        lines(H, '10/31/2026,x,-5'),
        'Dates in this file look month first, as in 10/31/2026. Write them day first, as 31/10/2026, or as year, month and day, as 2026-10-31.',
      ],
    ],
    bad_date: [
      [
        lines(H, '31 Oct 2026,x,-5'),
        'Row 2: “31 Oct 2026” isn’t a date Arthik can read. Write it as 2026-10-31, or day first, as 31/10/2026.',
      ],
      [lines(H, ',x,-5'), 'Row 2: The date is missing.'],
    ],
    bad_amount: [
      [
        lines(H, '2026-10-01,x,"12,50"'),
        'Row 2: “12,50” isn’t an amount Arthik can read. Write it in digits, with a point only before decimals, as in -1250.50.',
      ],
      [lines(H, '2026-10-01,x,'), 'Row 2: There’s no amount.'],
      [
        lines('date,description,withdrawal,deposit', '2026-10-01,x,-500,'),
        'Row 2: “-500” in the withdrawal column isn’t an amount Arthik can read. Write it in digits without a sign, with a point only before decimals.',
      ],
      [
        lines('date,description,debit,credit', '2026-10-01,x,,1.500'),
        'Row 2: “1.500” in the credit column isn’t an amount Arthik can read. Write it in digits without a sign, with a point only before decimals.',
      ],
      [lines('date,description,debit,credit', '2026-10-01,x,,'), 'Row 2: There’s no amount.'],
    ],
    bad_currency: [
      [
        lines(`${H},currency`, '2026-10-01,x,-5,TK'),
        'Row 2: “TK” isn’t a currency Arthik knows. Use a code from the Currency menu, or leave the cell empty.',
      ],
    ],
    bad_category: [
      [
        lines(`${H},category`, '2026-10-01,x,-5,Salary'),
        'Row 2: “Salary” isn’t a category Arthik knows for this row. Leave the cell empty and Arthik will choose one, which you can change.',
      ],
    ],
    bad_quotes: [
      [
        lines(H, '2026-10-01,"x,-5'),
        'Row 2: A quotation mark isn’t closed, so this row couldn’t be read. Add the missing quotation mark, or remove the stray one.',
      ],
      [
        lines(H, '2026-10-01,"x,-5', '2026-10-02,y,-6'),
        'Row 2: A quotation mark isn’t closed, so this row and the line after it couldn’t be read. Add the missing quotation mark, or remove the stray one.',
      ],
      [
        lines(H, '2026-10-01,"x,-5', '2026-10-02,y,-6', '', '2026-10-03,z,-7'),
        'Row 2: A quotation mark isn’t closed, so this row and about 2 lines after it couldn’t be read. Add the missing quotation mark, or remove the stray one.',
      ],
    ],
    extra_cells: [
      [
        lines(H, '2026-10-01,x,55,000'),
        'Row 2: This row has more cells than the header. A comma inside an amount or description usually causes it: put that cell in quotation marks, or remove the commas between thousands.',
      ],
    ],
  }

  const cases = Object.entries(CASES).flatMap(([code, list]) =>
    list.map(([text, shown]) => ({ code, text, shown })),
  )

  it.each(cases)('$code: $shown', async ({ code, text, shown }) => {
    // The case really is the code it is filed under.
    expect(parseTransactionsCsv(text, 'BDT').errors.map((e) => e.code)).toContain(code)
    vi.mocked(parseTransactionsCsv).mockClear()
    const { user } = renderUpload()

    await choose(user, csv(text))
    await submit(user)

    await main().findByRole('alert', { name: /^Arthik couldn’t read/ })
    expect(listed()).toContain(shown)
    // Problems with the whole file, or with its header, are not given row 0 or row 1.
    for (const item of listed()) expect(item).not.toMatch(/^Row [01]:/)
  })
})

describe('UploadPage: Review Focus 5', () => {
  it('changing the language or currency after an upload keeps the upload, the category changes and the score', async () => {
    const { router, user } = renderUpload()

    await choose(user, csv(template))
    await submit(user)
    await main().findByTestId('score')
    await waitFor(() => expect(session().activeKey).toBe('mine'))
    const upload = session().upload
    const rent = upload?.transactions.find((t) => t.category === 'rent')
    if (!rent) throw new Error('The template has a rent payment')
    act(() => session().overrideCategory(rent.id, 'eating_out'))
    await waitFor(() => expect(session().overrides).toEqual({ [rent.id]: 'eating_out' }))
    const score = main().getByTestId('score').textContent ?? ''

    await user.selectOptions(screen.getByLabelText('Currency'), 'USD')
    await user.selectOptions(screen.getByLabelText('Language'), 'bn')
    await waitFor(() => expect(html.lang).toBe('bn-BD'))

    expect(router.state.location.pathname).toBe('/score/mine')
    expect(session().upload).toBe(upload)
    expect(session().overrides).toEqual({ [rent.id]: 'eating_out' })
    const bengali = score.replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)] ?? digit)
    expect(main().getByTestId('score')).toHaveTextContent(bengali)
  })
})
