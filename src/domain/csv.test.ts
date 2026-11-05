import { describe, expect, it } from 'vitest'
import template from '../../public/arthik-template.csv?raw'
import { categorize } from './categorize'
import { MAX_ROWS, parseTransactionsCsv, type CsvError } from './csv'
import { completeMonths } from './period'
import type { Transaction } from './types'

const HEADER = 'date,description,amount,currency,category'

/** Joins lines into file text. */
function file(...lines: string[]): string {
  return lines.join('\n')
}

/** Parses a one-row file and returns that row's outcome. */
function parseRow(row: string, header = HEADER) {
  return parseTransactionsCsv(file(header, row), 'BDT')
}

/** The amount read from one cell, or undefined if the row did not import. */
function amountOf(cell: string): number | undefined {
  return parseRow(`2026-10-01,Test,"${cell}",,`).transactions[0]?.amount
}

describe('parseTransactionsCsv: reading a file', () => {
  const commaFile = file(
    HEADER,
    '2026-10-01,Salary credit,55000,BDT,',
    '2026-10-02,Foodpanda order,-720.5,BDT,',
    '2026-10-03,"Shop, Dhaka",-100,USD,Shopping',
  )

  it('turns rows into transactions', () => {
    const { transactions, errors } = parseTransactionsCsv(commaFile, 'BDT')
    expect(errors).toEqual([])
    expect(transactions).toEqual<Transaction[]>([
      {
        id: 'row-2',
        date: '2026-10-01',
        description: 'Salary credit',
        amount: 55000,
        currency: 'BDT',
        category: 'salary',
      },
      {
        id: 'row-3',
        date: '2026-10-02',
        description: 'Foodpanda order',
        amount: -720.5,
        currency: 'BDT',
        category: 'eating_out',
      },
      {
        id: 'row-4',
        date: '2026-10-03',
        description: 'Shop, Dhaka',
        amount: -100,
        currency: 'USD',
        category: 'shopping',
      },
    ])
  })

  it('reads a semicolon file the same as a comma file', () => {
    const semicolonFile = file(
      HEADER.replaceAll(',', ';'),
      '2026-10-01;Salary credit;55000;BDT;',
      '2026-10-02;Foodpanda order;-720.5;BDT;',
      '2026-10-03;Shop, Dhaka;-100;USD;Shopping',
    )
    expect(parseTransactionsCsv(semicolonFile, 'BDT')).toEqual(
      parseTransactionsCsv(commaFile, 'BDT'),
    )
  })

  it('finds the semicolons even when blank lines sit near the top', () => {
    // Blank lines count as one-column rows to a delimiter guess, and this many would
    // pull the average column count of a semicolon file below two.
    const semicolonFile = file(
      'date;description;amount',
      '',
      '',
      '',
      '',
      '2026-10-01;Salary credit;55000',
      '',
      '2026-10-02;Foodpanda order;-720.5',
    )
    const { transactions, errors } = parseTransactionsCsv(semicolonFile, 'BDT')
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([55000, -720.5])
  })

  it('strips a byte-order mark from the header', () => {
    const { transactions, errors } = parseTransactionsCsv(
      `\u{FEFF}${file(HEADER, '2026-10-01,Salary credit,55000,BDT,')}`,
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(1)
  })

  it('strips a byte-order mark in front of a quoted header', () => {
    const { transactions, errors } = parseTransactionsCsv(
      `\u{FEFF}"date","description","amount"\n2026-10-01,Salary credit,55000`,
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(1)
  })

  it('accepts Windows and old Mac line endings', () => {
    const lines = [HEADER, '2026-10-01,Salary credit,55000,BDT,', '2026-10-02,Rent,-16000,BDT,']
    for (const newline of ['\r\n', '\r']) {
      const { transactions, errors } = parseTransactionsCsv(lines.join(newline), 'BDT')
      expect(errors, JSON.stringify(newline)).toEqual([])
      expect(transactions, JSON.stringify(newline)).toHaveLength(2)
    }
  })

  it('reads a file whose header ends in CRLF and whose rows end in LF', () => {
    // PapaParse takes the line ending from the first line, so before the line endings were
    // normalised the rows below were one record and only the first was imported.
    const { transactions, errors } = parseTransactionsCsv(
      'Date,Description,Debit,Credit,Balance\r\n2026-10-01,Rent,800,,5000\n2026-10-02,Salary,,900,5900\n2026-10-03,Shop,100,,5800\n',
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -800],
      ['row-3', 900],
      ['row-4', -100],
    ])
  })

  it('reads a three-column file with a CRLF header and LF rows', () => {
    const { transactions, errors } = parseTransactionsCsv(
      'date,description,amount\r\n2026-10-01,a,-5\n2026-10-02,b,-7\n',
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-5, -7])
  })

  it('reads a file that mixes CRLF, LF and a lone CR, and counts each as one row break', () => {
    const { transactions, errors } = parseTransactionsCsv(
      'date,description,amount\n2026-10-01,a,-5\r\n2026-10-02,b,-7\r2026-10-03,c,abc\n2026-10-04,d,-9',
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -5],
      ['row-3', -7],
      ['row-5', -9],
    ])
    expect(errors).toEqual<CsvError[]>([
      { row: 4, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('reads a semicolon file with mixed line endings', () => {
    const { transactions, errors } = parseTransactionsCsv(
      'date;description;amount\r\n2026-10-01;a;-5\n2026-10-02;b;-7\n',
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-5, -7])
  })

  it('keeps a line break inside quotes as one row, whatever the file used for it', () => {
    const { transactions, errors } = parseTransactionsCsv(
      'date,description,amount\r\n2026-10-01,"Two\r\nline note",-5\n2026-10-02,b,-7\n',
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => [t.id, t.description])).toEqual([
      ['row-2', 'Two\nline note'],
      ['row-3', 'b'],
    ])
  })

  it('matches headers regardless of case and surrounding spaces', () => {
    const { transactions, errors } = parseRow(
      '2026-10-01,Salary credit,55000',
      ' Date , DESCRIPTION ,Amount',
    )
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(1)
  })

  it('ignores columns it does not know', () => {
    const { transactions, errors } = parseRow(
      'TX123,2026-10-01,Salary credit,55000,120000',
      'reference,date,description,amount,balance',
    )
    expect(errors).toEqual([])
    expect(transactions).toEqual([expect.objectContaining({ date: '2026-10-01', amount: 55000 })])
  })

  it('trims the description, and allows it to be empty', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,  Rent  ,-16000,,', '2026-10-02,,-50,,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.description)).toEqual(['Rent', ''])
  })
})

describe('parseTransactionsCsv: debit and credit columns', () => {
  it('turns debit into money out and credit into money in', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'Date,Description,Debit,Credit',
        '2026-10-01,Bazar,640,',
        '2026-10-02,Salary credit,,4000',
        '2026-10-03,Refund and fee,100,350',
      ),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-640, 4000, 250])
  })

  it('also accepts withdrawal and deposit', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,withdrawal,deposit', '2026-10-01,Bazar,640,', '2026-10-02,Gift,,4000'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-640, 4000])
  })

  it('reads thousands separators and currency signs in these columns too', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Rent,"৳ 16,000",', '2026-10-02,Pay,,"১,২৪০"'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-16000, 1240])
  })

  it('reports a negative debit or credit rather than guess what the sign means', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Bazar,-640,', '2026-10-02,Gift,,(40)'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'debit', value: '-640' },
      { row: 3, code: 'bad_amount', column: 'credit', value: '(40)' },
    ])
  })

  it('reports a row where both columns are empty', () => {
    const { errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Opening balance,,'),
      'BDT',
    )
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_amount', column: 'debit', value: '' }])
  })

  describe('a dash in a debit or credit cell (R51)', () => {
    // Some banks print a dash in the column a payment does not use.
    it.each(['-', '–', '—', ' - '])('reads %j as an empty cell', (dash) => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,debit,credit',
          `2026-10-01,Bazar,640,${dash}`,
          `2026-10-02,Salary credit,${dash},4000`,
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-640, 4000])
    })

    it('reports a row with a dash in both columns as having no amount', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,withdrawal,deposit', '2026-10-01,Opening balance,-,—'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'bad_amount', column: 'withdrawal', value: '' },
      ])
    })

    it('does not count a dash as filled when a trailing delimiter ends every row', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,debit,credit',
          '2026-10-01,Bazar,640,-,',
          '2026-10-02,Salary credit,–,4000,',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-640, 4000])
    })

    it('still reports a dash with anything else in the cell', () => {
      const { errors } = parseTransactionsCsv(
        file('date,description,debit,credit', '2026-10-01,Bazar,--,4000', '2026-10-02,Pay,,-5'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'bad_amount', column: 'debit', value: '--' },
        { row: 3, code: 'bad_amount', column: 'credit', value: '-5' },
      ])
    })

    it('still reports a lone dash in a signed amount column', () => {
      expect(parseRow('2026-10-01,Bazar,-,,').errors).toEqual<CsvError[]>([
        { row: 2, code: 'bad_amount', column: 'amount', value: '-' },
      ])
    })
  })

  it('prefers a signed amount column when the file also has debit and credit', () => {
    const { transactions } = parseTransactionsCsv(
      file('date,description,amount,debit,credit', '2026-10-01,Bazar,-640,640,'),
      'BDT',
    )
    expect(transactions.map((t) => t.amount)).toEqual([-640])
  })
})

describe('parseTransactionsCsv: dates', () => {
  it.each([
    ['31/10/2026', '2026-10-31'],
    ['31-10-2026', '2026-10-31'],
    ['31.10.2026', '2026-10-31'],
    ['2026-10-31', '2026-10-31'],
    ['1/2/2026', '2026-02-01'],
    ['2026-2-1', '2026-02-01'],
    ['29/02/2028', '2028-02-29'],
    ['২৯/১০/২০২৬', '2026-10-29'],
    ['  2026-10-31 ', '2026-10-31'],
  ])('reads %s as %s', (cell, expected) => {
    const { transactions, errors } = parseRow(`${cell},Test,-10,,`)
    expect(errors).toEqual([])
    expect(transactions[0]?.date).toBe(expected)
  })

  it.each([
    ['31/10/2026 14:03', '2026-10-31'],
    ['31/10/2026 14:03:22', '2026-10-31'],
    ['31-10-2026 2:03 PM', '2026-10-31'],
    ['31.10.2026 02:03 am', '2026-10-31'],
    ['2026-10-31 14:03:22', '2026-10-31'],
    ['2026-10-31T14:03:22', '2026-10-31'],
    ['2026-10-31T14:03:22Z', '2026-10-31'],
    ['2026-10-31T14:03:22+06:00', '2026-10-31'],
    // The date is the one written, never moved by the zone: in UTC these would be 30 Oct and 1 Nov.
    ['2026-10-31T01:00:00+06:00', '2026-10-31'],
    ['2026-10-31T23:30:00-06:00', '2026-10-31'],
    ['2026-10-31T14:03:22.123Z', '2026-10-31'],
    ['2026-10-31 14:03:22+0600', '2026-10-31'],
    ['2026-10-31T14:03', '2026-10-31'],
    ['2026-10-31t14:03:22z', '2026-10-31'],
    ['31/10/2026    14:03', '2026-10-31'],
    ['1/2/2026 9:05', '2026-02-01'],
    ['31/10/2026 00:00', '2026-10-31'],
    ['31/10/2026 23:59:59', '2026-10-31'],
    ['31/10/2026 12:00 AM', '2026-10-31'],
    ['31/10/2026 11:59 pm', '2026-10-31'],
    ['31/10/2026 00:30 AM', '2026-10-31'], // some systems count the 12-hour clock from 0
    ['31/10/2026 2:03:09 PM', '2026-10-31'],
    ['২৯/১০/২০২৬ ১৪:০৩', '2026-10-29'],
    ['29/02/2028 14:03', '2028-02-29'],
  ])('reads %s as %s, ignoring the time', (cell, expected) => {
    const { transactions, errors } = parseRow(`${cell},Test,-10,,`)
    expect(errors).toEqual([])
    expect(transactions[0]?.date).toBe(expected)
  })

  it('reads dates day first, so 10/31/2026 is not a date', () => {
    const { transactions, errors } = parseRow('10/31/2026,Test,-10,,')
    expect(transactions).toEqual([])
    // The row's own error is the bad_date; the other says why, for the whole file.
    expect(errors).toEqual<CsvError[]>([
      { row: 0, code: 'month_first_dates' },
      { row: 2, code: 'bad_date', column: 'date', value: '10/31/2026' },
    ])
  })

  it.each([
    '2026-02-30', // no 30 February
    '2027-02-29', // 2027 is not a leap year
    '2100-02-29', // 2100 is not a leap year either
    '31/04/2026', // April has 30 days
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '31/10/26', // two-digit years are ambiguous
    '2026/10/31', // not one of the accepted shapes
    '31/10-2026', // separators must match
    'yesterday',
    '',
    '31/10/2026 25:99', // not a time
    '31/10/2026 foo', // junk after the date
    '31/10/2026 14:60',
    '31/10/2026 14:03:60',
    '31/10/2026 24:00',
    '31/10/2026 13:00 PM', // 13 o'clock is not on a 12-hour clock
    '31/10/2026 14:03 foo',
    '31/10/2026 14:03:22 UTC',
    '31/10/2026 14',
    '31/10/2026 14:3',
    '31/10/2026 2:03 PM +06:00', // a zone only follows a 24-hour time
    '31/10/2026 2:03 XM',
    '31/10/2026T14:03', // T joins an ISO date to its time, not a day-first date
    '2026-10-31T',
    '2026-10-31Tfoo',
    '2026-10-31T25:00:00',
    '2026-10-31T14:03:22+25:00',
    '2026-10-31T14:03:22+',
    '2026-10-31 14:03:22Z extra',
    '2026-10-31 14:03 PM',
    '31/04/2026 14:03', // the time does not excuse a date that is not real
    '2026-02-30 14:03',
  ])('rejects "%s"', (cell) => {
    const { transactions, errors } = parseRow(`${cell},Test,-10,,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_date', column: 'date', value: cell }])
  })

  // A year outside 1990 to 2100 is a typo, or a spreadsheet's idea of "no date", and a real
  // calendar date all the same: 0000-02-29 passes the leap year rule.
  it.each([
    '0000-02-29',
    '0000-01-01',
    '31/10/0026',
    '31-10-0026',
    '1989-12-31',
    '31/12/1989',
    '2101-01-01',
    '01/01/2101',
    '9999-12-31',
    '0026-10-31T14:03:22+06:00',
  ])('rejects the year in "%s"', (cell) => {
    const { transactions, errors } = parseRow(`${cell},Test,-10,,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_date', column: 'date', value: cell }])
  })

  it.each([
    ['1990-01-01', '1990-01-01'],
    ['01/01/1990', '1990-01-01'],
    ['2100-12-31', '2100-12-31'],
    ['31/12/2100', '2100-12-31'],
    ['29/02/2000', '2000-02-29'],
  ])('still reads %s, a year at the edge of the range, as %s', (cell, expected) => {
    const { transactions, errors } = parseRow(`${cell},Test,-10,,`)
    expect(errors).toEqual([])
    expect(transactions[0]?.date).toBe(expected)
  })

  it('does not take a month-first date in an impossible year for a sign of month first', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount', '10/31/0026,Typo,-5', '10/05/2026,Rent,-100'),
      'BDT',
    )
    expect(transactions.map((t) => t.date)).toEqual(['2026-05-10'])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_date', column: 'date', value: '10/31/0026' },
    ])
  })
})

describe('parseTransactionsCsv: month-first dates', () => {
  // 10/05/2026 is 10 May day first and 5 October month first. On its own it is read day
  // first, as before. But a date such as 10/31/2026 can only be month first, and a file
  // that has one writes all its dates that way, so 10/05/2026 in it is not to be trusted.
  const HEAD = 'date,description,amount'

  it('reports every ambiguous date once the file shows it writes month first', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEAD,
        '10/05/2026,Rent,-100', // row 2: 10 May or 5 October
        '10/31/2026,Shop,-50', // row 3: can only be 31 October
        '05/05/2026,Same day and month,-20', // row 4: the same either way
        '2026-10-06,Written in full,-30', // row 5
        '13/10/2026,Plainly day first,-40', // row 6
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.date])).toEqual([
      ['row-4', '2026-05-05'],
      ['row-5', '2026-10-06'],
      ['row-6', '2026-10-13'],
    ])
    expect(errors).toEqual<CsvError[]>([
      { row: 0, code: 'month_first_dates' },
      { row: 2, code: 'bad_date', column: 'date', value: '10/05/2026' },
      { row: 3, code: 'bad_date', column: 'date', value: '10/31/2026' },
    ])
  })

  it('sees equal parts as the same date however many digits they are written with', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '5/05/2026,A,-1', '05/5/2026,B,-2', '5/5/2026,C,-3', '10/31/2026,D,-4'),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.date])).toEqual([
      ['row-2', '2026-05-05'],
      ['row-3', '2026-05-05'],
      ['row-4', '2026-05-05'],
    ])
    expect(errors.map((e) => [e.row, e.code])).toEqual([
      [0, 'month_first_dates'],
      [5, 'bad_date'],
    ])
  })

  it('does not mind which comes first, the ambiguous date or the one that gives it away', () => {
    const rows = ['10/05/2026,Rent,-100', '03/04/2026,Tea,-5', '10/31/2026,Shop,-50']
    for (const order of [rows, [...rows].reverse()]) {
      const { transactions, errors } = parseTransactionsCsv(file(HEAD, ...order), 'BDT')
      expect(transactions, order.join('|')).toEqual([])
      expect(errors.map((e) => e.code), order.join('|')).toEqual([
        'month_first_dates',
        'bad_date',
        'bad_date',
        'bad_date',
      ])
    }
  })

  it('reports the file even when no other date is ambiguous', () => {
    const { errors } = parseTransactionsCsv(file(HEAD, '10/31/2026,Shop,-50', '2026-10-01,Tea,-5'), 'BDT')
    expect(errors).toEqual<CsvError[]>([
      { row: 0, code: 'month_first_dates' },
      { row: 2, code: 'bad_date', column: 'date', value: '10/31/2026' },
    ])
  })

  it('reports it once however many month-first dates there are', () => {
    const { errors } = parseTransactionsCsv(
      file(HEAD, '10/31/2026,A,-1', '11/30/2026,B,-2', '12/25/2026,C,-3'),
      'BDT',
    )
    expect(errors.filter((e) => e.code === 'month_first_dates')).toEqual([
      { row: 0, code: 'month_first_dates' },
    ])
    expect(errors).toHaveLength(4)
  })

  it('leaves a file alone when none of its dates is impossible day first', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '10/05/2026,Rent,-100', '03/04/2026,Tea,-5', '31/10/2026,Shop,-50', '05/05/2026,Same,-1'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.date)).toEqual([
      '2026-05-10',
      '2026-04-03',
      '2026-10-31',
      '2026-05-05',
    ])
  })

  it('reads 10/05/2026 as 10 May when it is the only slash date', () => {
    const { transactions, errors } = parseRow('10/05/2026,Rent,-100,,')
    expect(errors).toEqual([])
    expect(transactions[0]?.date).toBe('2026-05-10')
  })

  it('does not take a date that is impossible both ways for a sign of month first', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '02/30/2026,Nonsense,-5', '13/45/2026,Nonsense,-6', '10/05/2026,Rent,-100'),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.date])).toEqual([['row-4', '2026-05-10']])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_date', column: 'date', value: '02/30/2026' },
      { row: 3, code: 'bad_date', column: 'date', value: '13/45/2026' },
    ])
  })

  it.each([
    ['10-31-2026', '10-05-2026'],
    ['10.31.2026', '10.05.2026'],
    ['1/13/2026', '1/2/2026'], // no leading zeros
    ['10/31/2026 14:03', '10/05/2026 14:03'], // with a time
    ['১০/৩১/২০২৬', '১০/০৫/২০২৬'], // Bengali digits
    ['02/29/2028', '03/04/2028'], // a leap day that exists only month first
  ])('sees month first in %s and rejects %s', (monthFirst, ambiguous) => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, `${ambiguous},Rent,-100`, `${monthFirst},Shop,-50`),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors.map((e) => [e.row, e.code])).toEqual([
      [0, 'month_first_dates'],
      [2, 'bad_date'],
      [3, 'bad_date'],
    ])
  })

  it('counts a month-first date on a row that is skipped for being zero', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '10/31/2026,Balance enquiry,0', '10/05/2026,Rent,-100'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 0, code: 'month_first_dates' },
      { row: 3, code: 'bad_date', column: 'date', value: '10/05/2026' },
    ])
  })

  it('counts a month-first date on a row with another problem', () => {
    const { errors } = parseTransactionsCsv(
      file(HEAD, '10/31/2026,Shop,abc', '10/05/2026,Rent,-100'),
      'BDT',
    )
    expect(errors).toEqual<CsvError[]>([
      { row: 0, code: 'month_first_dates' },
      { row: 2, code: 'bad_date', column: 'date', value: '10/31/2026' },
      { row: 2, code: 'bad_amount', column: 'amount', value: 'abc' },
      { row: 3, code: 'bad_date', column: 'date', value: '10/05/2026' },
    ])
  })

  it('also sees a month-first date in a swallowed line when it looks for a merged record', () => {
    // The line after the stray quote starts with 10/31/2026, which is a date written month first.
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '2026-10-01,"Eid shopping,-7', '10/31/2026,Monitor 24",-8', '2026-10-04,e,-9'),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-3'])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('does not apply to ISO dates', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEAD, '2026-10-05,Rent,-100', '2026-10-31,Shop,-50'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(2)
  })
})

describe('parseTransactionsCsv: amounts', () => {
  it.each([
    ['1,234.50', 1234.5],
    ['(640)', -640],
    ['৳ 1,240', 1240],
    ['১,২৪০', 1240],
    ['-৳640', -640],
    ['৳-640', -640],
    ['(৳ 640)', -640],
    ['$1,000', 1000],
    ['£12.99', 12.99],
    ['€ 7', 7],
    ['\u{2212}640', -640], // the minus sign that word processors produce
    ['+4,000', 4000],
    ['1,50,000', 150000], // lakh grouping, as Bangladeshi banks print it
    ['12,34,567.89', 1234567.89],
    ['1 234', 1234],
    ['1\u{A0}234', 1234],
    ['১২.৫০', 12.5],
    ['0.5', 0.5],
  ])('reads %s as %d', (cell, expected) => {
    expect(amountOf(cell)).toBe(expected)
  })

  it('reports a cell that is not a number', () => {
    const { transactions, errors } = parseRow('2026-10-01,Test,abc,,')
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it.each([
    '', // missing
    '12,50', // a decimal comma: reading it as 1250 would be silently wrong
    '1.234,50',
    '1,2345',
    '1,23',
    '1,,234',
    ',500',
    '500,',
    '1e3',
    '5-',
    '--5',
    '(-640)', // a bracket already means negative
    '()',
    '12.',
    '.5',
    '1.2.3',
    '640 BDT',
    'NaN',
    'Infinity',
  ])('rejects "%s"', (cell) => {
    const { transactions, errors } = parseRow(`2026-10-01,Test,"${cell}",,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: cell },
    ])
  })

  // 1.500 is 1500 where a point groups thousands (Germany, Italy, Indonesia) and 1.5 where a
  // point is the decimal mark. Nothing in the cell says which, and guessing 1.5 for what the
  // bank meant as 1500 would be silently wrong.
  it.each([
    '1.500',
    '-1.500',
    '3.200',
    '+3.200',
    '1.234.567',
    '100.500',
    '(1.500)',
    '৳ 1.500',
    '$1.500',
    '১.৫০০', // Bengali digits
    '12.345',
  ])('rejects the dotted-thousands lookalike "%s"', (cell) => {
    const { transactions, errors } = parseRow(`2026-10-01,Test,"${cell}",,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: cell },
    ])
  })

  it.each([
    ['1.50', 1.5],
    ['1.5', 1.5],
    ['1234.5', 1234.5],
    ['12.34', 12.34],
    ['1.5000', 1.5], // four decimals cannot be a thousands group
    ['1234.567', 1234.567], // the whole part is too long to be a group before a point
    ['1,234.567', 1234.567], // the comma groups, so the point is the decimal mark
    ['1,500', 1500],
    ['1500.00', 1500],
  ])('still reads %s as %d', (cell, expected) => {
    expect(amountOf(cell)).toBe(expected)
  })

  // A space inside a number groups thousands exactly as a comma does (French, Russian and
  // many bank exports). A space that does not make a group, such as 12 50, is the same
  // ambiguity as 12,50: it may be a decimal mark, so it is not read.
  it.each([
    ['1 234', 1234],
    ['1 234 567', 1234567], // Western groups
    ['12 345 678', 12345678],
    ['1 23 456', 123456], // lakh groups
    ['12 34 567', 1234567],
    ['1 23 45 678', 12345678],
    ['1 234.50', 1234.5],
    ['1 23 456.78', 123456.78],
    ['-1 234 567', -1234567],
    ['(1 234)', -1234],
    ['৳ 1 234', 1234],
    ['১ ২৩৪', 1234], // Bengali digits
    ['1\u{A0}234\u{A0}567', 1234567],
    ['1\u{202F}234', 1234], // the narrow no-break space that French locales use
  ])('reads %s as %d, a space grouping thousands', (cell, expected) => {
    expect(amountOf(cell)).toBe(expected)
  })

  it.each([
    ['  1,240  ', 1240], // leading and trailing space
    [' 1234 ', 1234],
    ['\u{A0}1234\u{A0}', 1234],
    ['৳ 1,240', 1240], // a space between a currency sign and the number
    ['৳1,240', 1240],
    ['1,240 ৳', 1240],
    ['$ 5', 5],
    ['€ 7.50', 7.5],
    ['- 640', -640], // a space after the sign
    ['-৳ 640', -640],
    ['৳ -640', -640],
    ['- ৳ 640', -640],
    ['( 640 )', -640],
    ['(৳ 640)', -640],
    ['+ 4,000', 4000],
    ['৳ 1 234', 1234],
  ])('still ignores the space around the number in "%s"', (cell, expected) => {
    expect(amountOf(cell)).toBe(expected)
  })

  it.each([
    '12 50', // 12.50 written with a space, or 1250?
    '1 2345',
    '1 23',
    '1 2',
    '5 0',
    '12 345 67',
    '1 234 56',
    '1234 567', // too long a first group
    '123 45 678', // the first group of lakh is at most two digits
    '1  234', // a double space is not one group
    '1 234  567',
    '1 \u{A0}234',
    '1,234 567', // commas and spaces do not mix
    '1 234,567',
    '1 234,50',
    '1,23 456',
    '1 234 .50', // a space beside the decimal point
    '1 234. 50',
    '12 .5',
    '12. 5',
    '12.5 0',
    '12 ৳ 50', // a currency sign does not join the parts
    '1 ৳ 234',
    '1 $ 234',
    '- 1 2345',
    '(12 50)',
  ])('rejects "%s", a space that does not group thousands', (cell) => {
    const { transactions, errors } = parseRow(`2026-10-01,Test,"${cell}",,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: cell.trim() },
    ])
  })

  it('rejects a space that does not group thousands in an unquoted cell and in debit and credit columns', () => {
    expect(parseRow('2026-10-01,Test,12 50,,').errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: '12 50' },
    ])
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Rent,12 50,', '2026-10-02,Pay,,1 2345'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'debit', value: '12 50' },
      { row: 3, code: 'bad_amount', column: 'credit', value: '1 2345' },
    ])
  })

  it('reads a spaced thousands group in the debit and credit columns', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Rent,"18 000",', '2026-10-02,Pay,,"1 23 456"'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-18000, 123456])
  })

  it('rejects dotted thousands in a semicolon file, where the decimal mark is a comma', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date;description;amount', '01.10.2026;Miete;-1.500', '02.10.2026;Gehalt;3.200'),
      'EUR',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: '-1.500' },
      { row: 3, code: 'bad_amount', column: 'amount', value: '3.200' },
    ])
  })

  it('rejects dotted thousands in the debit and credit columns too', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Rent,1.500,', '2026-10-02,Pay,,3.200'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'debit', value: '1.500' },
      { row: 3, code: 'bad_amount', column: 'credit', value: '3.200' },
    ])
  })

  it('rejects a number so large that it is not finite', () => {
    expect(parseRow(`2026-10-01,Test,${'9'.repeat(400)},,`).errors).toEqual([
      expect.objectContaining({ row: 2, code: 'bad_amount' }),
    ])
  })

  // The domain code keeps money as a number, and a sum of cents is only exact up to
  // Number.MAX_SAFE_INTEGER. Past that the last digits are made up.
  it.each([
    '12345678901234567', // 17 digits: the number rounds to 12345678901234568
    '90071992547410', // 9007199254741000 cents is above Number.MAX_SAFE_INTEGER
    '-90071992547410',
    '(90071992547410)',
    '90071992547409.99',
    '1,000,000,000,000,000',
  ])('rejects "%s", which is more than can be added up to the cent', (cell) => {
    const { transactions, errors } = parseRow(`2026-10-01,Test,"${cell}",,`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: cell },
    ])
  })

  it.each([
    ['90071992547409', 90071992547409], // 9007199254740900 cents: below the limit
    ['-90071992547409', -90071992547409],
    ['9,999,999,999.99', 9999999999.99],
    ['1,00,00,00,000', 1000000000], // a hundred crore
  ])('still reads %s, an amount that large', (cell, expected) => {
    expect(amountOf(cell)).toBe(expected)
  })

  it('rejects an amount that is too large in the debit or credit column', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,debit,credit',
        '2026-10-01,Rent,12345678901234567,',
        '2026-10-02,Pay,,12345678901234567',
      ),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'debit', value: '12345678901234567' },
      { row: 3, code: 'bad_amount', column: 'credit', value: '12345678901234567' },
    ])
  })

  it('skips a row whose amount is zero, without an error', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,Balance enquiry,0,,',
        '2026-10-02,Balance enquiry,0.00,,',
        '2026-10-03,Balance enquiry,(0),,',
        '2026-10-04,Real payment,-50,,',
      ),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.id)).toEqual(['row-5'])
  })

  it('skips a zero row even if its other cells are unreadable', () => {
    const { transactions, errors } = parseRow('not a date,Balance enquiry,0,XYZ,nonsense')
    expect(transactions).toEqual([])
    expect(errors).toEqual([])
  })

  it('skips a debit/credit row that nets to zero', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,debit,credit', '2026-10-01,Enquiry,0,', '2026-10-02,Enquiry,,0'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual([])
  })
})

describe('parseTransactionsCsv: currency', () => {
  it('uses the default currency when the cell is empty', () => {
    expect(parseRow('2026-10-01,Test,-10,,').transactions[0]?.currency).toBe('BDT')
    expect(
      parseTransactionsCsv(file(HEADER, '2026-10-01,Test,-10,,'), 'GBP').transactions[0]?.currency,
    ).toBe('GBP')
  })

  it('uses the default currency when the file has no currency column', () => {
    const { transactions } = parseTransactionsCsv(
      file('date,description,amount', '2026-10-01,Test,-10'),
      'SGD',
    )
    expect(transactions[0]?.currency).toBe('SGD')
  })

  it('upper-cases and trims the code', () => {
    expect(parseRow('2026-10-01,Test,-10, usd ,').transactions[0]?.currency).toBe('USD')
  })

  it('reports an unsupported code', () => {
    const { transactions, errors } = parseRow('2026-10-01,Test,-10,XYZ,')
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_currency', column: 'currency', value: 'XYZ' },
    ])
  })
})

describe('parseTransactionsCsv: categories', () => {
  it.each([
    ['Groceries', -100, 'groceries'],
    ['groceries', -100, 'groceries'],
    ['  GROCERIES ', -100, 'groceries'],
    ['eating_out', -100, 'eating_out'],
    ['Eating out & delivery', -100, 'eating_out'],
    ['eating   OUT & Delivery', -100, 'eating_out'],
    ['Rent & housing', -100, 'rent'],
    ['Mobile & internet', -100, 'mobile_internet'],
    ['Savings deposit / DPS', -100, 'savings_deposit'],
    ['Sanchayapatra & investments', -100, 'investments'],
    ['Uncategorised', -100, 'uncategorised_out'],
    ['Salary', 100, 'salary'],
    ['family_support_in', 100, 'family_support_in'],
    ['Refund or reversal', 100, 'refund'],
    ['Own-account transfer', 100, 'own_transfer'],
    ['Own-account transfer', -100, 'own_transfer'],
  ] as const)('reads %s on %d as %s', (cell, amount, expected) => {
    // The description would not match anything, so the category must come from the cell.
    const { transactions, errors } = parseRow(`2026-10-01,Zzz,${amount},,"${cell}"`)
    expect(errors).toEqual([])
    expect(transactions[0]?.category).toBe(expected)
  })

  it('reports a category it does not know', () => {
    const { transactions, errors } = parseRow('2026-10-01,Test,-10,,nonsense')
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_category', column: 'category', value: 'nonsense' },
    ])
  })

  it.each([
    ['Salary', -100], // an income category on money out
    ['Groceries', 100], // a spending category on money in
    ['Uncategorised', 100],
    ['loan_received', -100],
  ] as const)('reports %s on %d, because it does not fit the direction', (cell, amount) => {
    const { transactions, errors } = parseRow(`2026-10-01,Test,${amount},,${cell}`)
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_category', column: 'category', value: cell },
    ])
  })

  it('does not check a category against a direction it cannot know', () => {
    // The amount is bad, so only the amount is reported.
    const { errors } = parseRow('2026-10-01,Test,abc,,Salary')
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('categorises from the description when the cell is empty', () => {
    const { transactions } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,DESCO prepaid electricity,-1850,,',
        '2026-10-02,SALARY OCT ACME LTD,55000,,',
        '2026-10-03,Unheard-of shop,-300,,',
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.category)).toEqual(['utilities', 'salary', 'uncategorised_out'])
  })

  it('also categorises when the file has no category column', () => {
    const { transactions } = parseTransactionsCsv(
      file('date,description,amount', '2026-10-01,Titas Gas bill,-950'),
      'BDT',
    )
    expect(transactions[0]?.category).toBe('utilities')
  })

  it('gives the categoriser the signed amount', () => {
    const { transactions } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,Tuition,5000,,', '2026-10-02,Tuition,-5000,,'),
      'BDT',
    )
    expect(transactions.map((t) => t.category)).toEqual(['side_income', 'education'])
  })

  it('copies the unrecognised-income flag from the categoriser', () => {
    const description = 'Received from 01712345678'
    expect(categorize(description, 500).unrecognisedIncome).toBe(true)

    const { transactions } = parseTransactionsCsv(
      file(HEADER, `2026-10-01,${description},500,,`, '2026-10-02,SALARY OCT,55000,,'),
      'BDT',
    )
    expect(transactions[0]).toMatchObject({ category: 'other_income', unrecognisedIncome: true })
    expect(transactions[1]?.unrecognisedIncome).toBeUndefined()
  })

  it('does not flag income whose category the file gave', () => {
    const { transactions } = parseRow('2026-10-01,Received from 01712345678,500,,Other income')
    expect(transactions[0]?.category).toBe('other_income')
    expect(transactions[0]?.unrecognisedIncome).toBeUndefined()
  })
})

describe('parseTransactionsCsv: row numbers and bad rows', () => {
  it('imports the good rows and reports the bad ones', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,Good one,-10,,',
        '31/31/2026,Bad date,-10,,',
        '2026-10-03,Bad amount,abc,,',
        '2026-10-04,Good two,-20,,',
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.description])).toEqual([
      ['row-2', 'Good one'],
      ['row-5', 'Good two'],
    ])
    expect(errors).toEqual<CsvError[]>([
      { row: 3, code: 'bad_date', column: 'date', value: '31/31/2026' },
      { row: 4, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('reports every bad cell in a row, in column order', () => {
    const { errors } = parseRow('nope,Test,abc,XYZ,nonsense')
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_date', column: 'date', value: 'nope' },
      { row: 2, code: 'bad_amount', column: 'amount', value: 'abc' },
      { row: 2, code: 'bad_currency', column: 'currency', value: 'XYZ' },
    ])
  })

  it('skips blank lines without reporting them, and still counts them in row numbers', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEADER,
        '', // row 2
        '2026-10-01,Good one,-10,,', // row 3
        '   ', // row 4
        ',,,,', // row 5: what a spreadsheet writes for an empty row
        '2026-10-05,Bad amount,abc,,', // row 6
        '', // row 7
        '', // row 8, after the final newline
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-3'])
    expect(errors).toEqual<CsvError[]>([
      { row: 6, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('counts a quoted line break as part of one row, as a spreadsheet does', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,"Two\nline note",-10,,', '2026-10-02,Bad amount,abc,,'),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.description])).toEqual([['row-2', 'Two\nline note']])
    expect(errors).toEqual<CsvError[]>([
      { row: 3, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('reports a row that is too short as missing its amount', () => {
    const { errors } = parseTransactionsCsv(file(HEADER, '2026-10-01,Cut off'), 'BDT')
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_amount', column: 'amount', value: '' }])
  })

})

describe('parseTransactionsCsv: rows with more cells than the header', () => {
  // An amount such as 55,000 that is not in quotes is two cells. Everything after it shifts
  // one place right, so the row would otherwise import as 55 with the 000 ignored. These rows
  // use no quotes on purpose; the other tests quote the amount.
  const THREE = 'date,description,amount'
  const SPLIT = 'Date,Description,Debit,Credit'

  it('does not import +55 for an unquoted 55,000', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Salary credit,55,000', '2026-10-02,Rent,-18,000'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'extra_cells' },
      { row: 3, code: 'extra_cells' },
    ])
  })

  it('does not import an unquoted decimal comma as the whole number', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Tea,-12,50'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('does not import a description with a comma and a number as an amount', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Flat 5, 300,-100'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('catches an unquoted credit in a debit and credit file', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(SPLIT, '2026-10-01,Salary credit,,55,000'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('catches an unquoted debit in a debit and credit file, even with an empty cell after it', () => {
    // The empty credit cell is pushed off the end, so the extra cell is empty. But the row
    // now has a debit of 18 and a credit of 000, which is not what the bank wrote.
    for (const row of ['2026-10-01,House rent,18,000,', '2026-10-01,House rent,18,500,']) {
      const { transactions, errors } = parseTransactionsCsv(file(SPLIT, row), 'BDT')
      expect(transactions, row).toEqual([])
      expect(errors, row).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
    }
  })

  it('catches the shift in a debit, credit and balance file', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('Date,Description,Debit,Credit,Balance', '2026-10-01,House rent,18,000,,1,20,000'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('catches it in a semicolon file', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date;description;amount', '01.10.2026;Miete;-1;500', '02.10.2026;Gehalt;55;000'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'extra_cells' },
      { row: 3, code: 'extra_cells' },
    ])
  })

  it('reports only extra_cells for a row whose cells cannot be trusted to line up', () => {
    const { errors } = parseTransactionsCsv(file(THREE, 'nope,Test,abc,x,y'), 'BDT')
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('checks the row even when its amount reads as zero', () => {
    const { transactions, errors } = parseTransactionsCsv(file(THREE, '2026-10-01,Enquiry,0,5'), 'BDT')
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('imports the other rows and reports in row order', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        THREE,
        '2026-10-01,Good one,-10', // row 2
        '2026-10-02,Shifted,-1,500', // row 3
        '2026-10-03,Bad amount,abc', // row 4
        '2026-10-04,Good two,-20', // row 5
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -10],
      ['row-5', -20],
    ])
    expect(errors).toEqual<CsvError[]>([
      { row: 3, code: 'extra_cells' },
      { row: 4, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })

  it('still reads a quoted amount with a comma in it', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Salary credit,"55,000"', '2026-10-02,Rent,"-18,000"'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([55000, -18000])
  })

  // A shifted row can hide behind an empty cell: the empty cell that was last is pushed one
  // place right, off the end of the columns, and what is left looks like a harmless trailing
  // comma. So an empty extra cell is only allowed when the whole file has one (R28).
  describe('a shifted row whose extra cell is empty', () => {
    it('does not import -18 for an unquoted -18,500 beside a balance column', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance',
          '2026-10-01,Salary credit,55000,70000', // row 2
          '2026-10-02,Rent,-18,500,', // row 3: the empty balance is pushed off the end
          '2026-10-03,Tea,-120,69880', // row 4
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', 55000],
        ['row-4', -120],
      ])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })

    it('does not import +55 for an unquoted 55,000 when the description is last', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,amount,description',
          '2026-10-01,-100,Tea', // row 2
          '2026-10-02,55,000,', // row 3: amount 55, description 000
          '2026-10-03,-20,Bus', // row 4
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', -100],
        ['row-4', -20],
      ])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })

    it('reports each such row, in row order, among other row errors', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance',
          '2026-10-01,Rent,-18,500,', // row 2
          '2026-10-02,Tea,abc,100', // row 3
          '2026-10-03,Bus,-5,95', // row 4
          '2026-10-04,Salary credit,55,000,', // row 5
        ),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-4'])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'bad_amount', column: 'amount', value: 'abc' },
        { row: 5, code: 'extra_cells' },
      ])
    })
  })

  describe('a trailing empty cell on every row', () => {
    // Some exporters end every line with the delimiter. That is one longer length for the
    // whole file, with nothing in the extra cell.
    it('imports every row when each one ends with the same empty cell', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          THREE,
          '2026-10-01,Salary credit,55000,',
          '2026-10-02,Rent,-500,',
          '2026-10-03,Tea,-12,',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', 55000],
        ['row-3', -500],
        ['row-4', -12],
      ])
    })

    it('imports a file of a single row that ends with an empty cell', () => {
      const { transactions, errors } = parseTransactionsCsv(file(THREE, '2026-10-01,Rent,-500,'), 'BDT')
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-500])
    })

    it('imports rows that all end with two empty cells, or with blank-looking ones', () => {
      for (const rows of [
        ['2026-10-01,Rent,-500,,', '2026-10-02,Tea,-12,,'],
        ['2026-10-01,Rent,-500, ,  ', '2026-10-02,Tea,-12,  ,\t'],
      ]) {
        const { transactions, errors } = parseTransactionsCsv(file(THREE, ...rows), 'BDT')
        expect(errors, rows.join('|')).toEqual([])
        expect(transactions.map((t) => t.amount), rows.join('|')).toEqual([-500, -12])
      }
    })

    it('imports them in a semicolon file', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date;description;amount', '01.10.2026;Miete;-500;', '02.10.2026;Gehalt;55000;'),
        'EUR',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-500, 55000])
    })

    it('does not count blank rows, whatever their length, when comparing the rows', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', ',,,,,', '2026-10-02,Tea,-12,', ''),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-4'])
    })

    it('still reports the other problems of a row, such as a bad date', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', 'nope,Tea,-12,'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-2'])
      expect(errors).toEqual<CsvError[]>([
        { row: 3, code: 'bad_date', column: 'date', value: 'nope' },
      ])
    })

    it('allows it after a header padded with empty cells, past the padding', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount,,', '2026-10-01,Rent,-500,,,', '2026-10-02,Tea,-12,,,'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-500, -12])
    })

    it('still catches a shifted amount under a padded header, whatever the file ends with', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount,,', '2026-10-01,Rent,-18,500,,', '2026-10-02,Tea,-12'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-3'])
      expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
    })
  })

  // The padding of a header does not count as columns (R33a), so it cannot make room for a
  // shifted row either: a row is longer than the header once it is longer than the last name.
  describe('a header that ends with empty cells (R33a)', () => {
    it('does not let the padding hide a shifted row among unpadded rows', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance,',
          '2026-10-01,Tea,-12,100', // row 2
          '2026-10-02,Rent,-18,500,', // row 3: the empty balance is pushed off the end
          '2026-10-03,Bus,-5,95', // row 4
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', -12],
        ['row-4', -5],
      ])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })

    it('counts the padding no matter how many cells it is', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance,,,',
          '2026-10-01,Tea,-12,100', // row 2
          '2026-10-02,Rent,-18,500,,,', // row 3: as long as the header, padding and all
          '2026-10-03,Bus,-5,95', // row 4
        ),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-4'])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })

    it('imports rows that are all padded to the same length, however far', () => {
      for (const [header, pad] of [
        ['date,description,amount,balance,', ','],
        ['date,description,amount,balance,,,', ',,,'],
        ['date,description,amount,balance,,,', ','],
        ['date,description,amount,balance,', ',,,'],
      ] as const) {
        const { transactions, errors } = parseTransactionsCsv(
          file(header, `2026-10-01,Tea,-12,100${pad}`, `2026-10-02,Bus,-5,95${pad}`),
          'BDT',
        )
        expect(errors, header + pad).toEqual([])
        expect(transactions.map((t) => t.amount), header + pad).toEqual([-12, -5])
      }
    })

    it('imports unpadded rows under a padded header', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount,balance,', '2026-10-01,Tea,-12,100', '2026-10-02,Bus,-5,95'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-12, -5])
    })

    it('reports a padded row beside a shifted one, since the file no longer pads every row alike', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount,,', '2026-10-01,Rent,-18,500,,', '2026-10-02,Tea,-12,,,'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'extra_cells' },
      ])
    })
  })

  // Summary lines at the end of an export (Closing balance,5000) are not transactions and do not
  // have the exporter's trailing delimiter. They have no readable date, so they are left out
  // when the rows are compared; they still get their own error, as they always did (R33b).
  describe('a footer line in a file that ends every row with an empty cell (R33b)', () => {
    it('imports the transactions and reports only the footer line', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          THREE,
          '2026-10-01,Rent,-500,', // row 2
          '2026-10-02,Tea,-12,', // row 3
          'Closing balance,5000', // row 4
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', -500],
        ['row-3', -12],
      ])
      expect(errors).toEqual<CsvError[]>([
        { row: 4, code: 'bad_date', column: 'date', value: 'Closing balance' },
        { row: 4, code: 'bad_amount', column: 'amount', value: '' },
      ])
    })

    it('does so wherever the footer, or a heading, stands', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          THREE,
          'Opening balance,5000', // row 2: first, but not a dated row
          '2026-10-01,Rent,-500,', // row 3
          'Total,-512', // row 4: a footer with a comma in the middle of the data
          '2026-10-02,Tea,-12,', // row 5
          ',Page 1 of 1', // row 6: no date at all
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-3', -500],
        ['row-5', -12],
      ])
      expect(errors.map((e) => [e.row, e.code])).toEqual([
        [2, 'bad_date'],
        [2, 'bad_amount'],
        [4, 'bad_date'],
        [4, 'bad_amount'],
        [6, 'bad_date'],
        [6, 'bad_amount'],
      ])
    })

    it('leaves out a footer of any length, and still gives it its own error', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', '2026-10-02,Tea,-12,', 'Closing balance,5000,,,,'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-3'])
      expect(errors).toEqual<CsvError[]>([
        { row: 4, code: 'bad_date', column: 'date', value: 'Closing balance' },
        { row: 4, code: 'bad_amount', column: 'amount', value: '' },
      ])
    })

    it('still reports a footer that has something in a cell past the header as extra_cells', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', '2026-10-02,Tea,-12,', 'Total,1,2,3'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-3'])
      expect(errors).toEqual<CsvError[]>([{ row: 4, code: 'extra_cells' }])
    })

    it('works in a semicolon file', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date;description;amount', '01.10.2026;Miete;-500;', '02.10.2026;Tee;-12;', 'Summe;-512'),
        'EUR',
      )
      expect(transactions.map((t) => t.amount)).toEqual([-500, -12])
      expect(errors.map((e) => [e.row, e.code])).toEqual([
        [4, 'bad_date'],
        [4, 'bad_amount'],
      ])
    })

    it('still compares the rows that have a date: one that differs leaves none of them trusted', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          THREE,
          '2026-10-01,Rent,-500,', // row 2
          '2026-10-02,Tea,-12', // row 3: dated, and without the trailing cell
          '2026-10-03,Bus,-30,', // row 4
          'Closing balance,5000', // row 5
        ),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-3'])
      expect(errors.map((e) => [e.row, e.code])).toEqual([
        [2, 'extra_cells'],
        [4, 'extra_cells'],
        [5, 'bad_date'],
        [5, 'bad_amount'],
      ])
    })

    it('does not let a footer hide a shifted dated row', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance',
          '2026-10-01,Tea,-12,100,', // row 2
          '2026-10-02,Rent,-18,500,,', // row 3: shifted, and a cell longer than the others
          'Closing balance,5000', // row 4
        ),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors.map((e) => [e.row, e.code])).toEqual([
        [2, 'extra_cells'],
        [3, 'extra_cells'],
        [4, 'bad_date'],
        [4, 'bad_amount'],
      ])
    })

    it('compares every row when none of them has a readable date', () => {
      // The visitor's problem is the date format, so that is what each row says.
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, 'Oct 1 2026,Rent,-500,', 'Oct 2 2026,Tea,-12,'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'bad_date', column: 'date', value: 'Oct 1 2026' },
        { row: 3, code: 'bad_date', column: 'date', value: 'Oct 2 2026' },
      ])
    })
  })

  describe('rows of different lengths', () => {
    it('reports every row longer than the header when only some end with an empty cell', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          THREE,
          '2026-10-01,Salary credit,55000,', // row 2
          '2026-10-02,Rent,-18000,', // row 3
          '2026-10-03,Tea,-12', // row 4: the one row without it
          '2026-10-04,Bus,-30,', // row 5
        ),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([['row-4', -12]])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'extra_cells' },
        { row: 5, code: 'extra_cells' },
      ])
    })

    it('reports them when the longer rows are not all the same length', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', '2026-10-02,Tea,-12,,'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'extra_cells' },
      ])
    })

    it('reports them when a row is shorter than the header', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', '2026-10-02,Tea'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'bad_amount', column: 'amount', value: '' },
      ])
    })

    it('reports every longer row when the rows are the same length but one extra cell is not empty', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(THREE, '2026-10-01,Rent,-500,', '2026-10-02,Tea,-12,x', '2026-10-03,Bus,-30,'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([
        { row: 2, code: 'extra_cells' },
        { row: 3, code: 'extra_cells' },
        { row: 4, code: 'extra_cells' },
      ])
    })

    it('does not rescue a debit and credit row that fills both columns', () => {
      // The trailing cell is allowed, but a debit and a credit side by side is how 18,000 looks
      // once it is split: a debit of 18, a credit of 000 and the empty credit cell pushed off.
      const { transactions, errors } = parseTransactionsCsv(
        file(SPLIT, '2026-10-01,House rent,18000,,', '2026-10-02,House rent,18,000,', '2026-10-03,Salary credit,,55000,'),
        'BDT',
      )
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', -18000],
        ['row-4', 55000],
      ])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })
  })

  it('allows an empty cell after a debit or credit that fills only one of the two', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(SPLIT, '2026-10-01,House rent,18000,,', '2026-10-02,Salary credit,,55000,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-18000, 55000])
  })

  // Many banks write 0.00 in the column a payment does not use, and some end every line with a
  // delimiter as well. A written zero is not a number in that column, so it does not make the
  // row look like a split 18,000 (a debit of 18 beside a credit of 000).
  describe('a written zero in the unused debit or credit column (R32)', () => {
    const BALANCE = 'Date,Description,Debit,Credit,Balance'

    it('imports rows that write 0.00 in the unused column and end with a delimiter', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          BALANCE,
          '2026-10-01,Rent,800.00,0.00,5000.00,',
          '2026-10-02,Salary,0.00,900.00,5900.00,',
          '2026-10-03,Shop,100.00,0.00,5800.00,',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => [t.id, t.amount])).toEqual([
        ['row-2', -800],
        ['row-3', 900],
        ['row-4', -100],
      ])
    })

    it('imports them when the header ends with a delimiter too', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'Date,Description,Debit,Credit,Balance,',
          '2026-10-01,Rent,800.00,0.00,5000.00,',
          '2026-10-02,Salary,0.00,900.00,5900.00,',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-800, 900])
    })

    it('imports them under a header padded with empty cells and rows padded the same way', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('Date,Description,Debit,Credit,,', '2026-10-01,Rent,800,0,,', '2026-10-02,Salary,0,900,,'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-800, 900])
    })

    it('still imports them when there is no trailing delimiter at all', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(BALANCE, '2026-10-01,Rent,800.00,0.00,5000.00', '2026-10-02,Salary,0.00,900.00,5900.00'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-800, 900])
    })

    it.each(['0', '0.0', '0.00', ' 0.00 ', '-0.00', '(0.00)', '৳0.00', '0.00 ৳', '০', '০.০০'])(
      'treats %j as a zero, not as a number in that column',
      (zero) => {
        const { transactions, errors } = parseTransactionsCsv(
          file(SPLIT, `2026-10-01,Rent,800,"${zero}",`, `2026-10-02,Salary,"${zero}",900,`),
          'BDT',
        )
        expect(errors).toEqual([])
        expect(transactions.map((t) => t.amount)).toEqual([-800, 900])
      },
    )

    it('skips a row that writes a zero in both columns, as it does without the trailing delimiter', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(BALANCE, '2026-10-01,Rent,800.00,0.00,5000.00,', '2026-10-02,Enquiry,0.00,0.00,5000.00,'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.id)).toEqual(['row-2'])
    })

    it('still reports a row that fills both columns with real amounts', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(BALANCE, '2026-10-01,Rent,800.00,0.00,5000.00,', '2026-10-02,Refund and fee,100.00,350.00,5250.00,'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-2'])
      expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'extra_cells' }])
    })

    // What is left of 18,000 once the comma cuts it in two is a debit of 18 and a credit of 000
    // (or 000.00 for 18,000.00, or 00 for 18,00). Those are not written zeros: a zero is a single
    // 0, with or without a decimal part, and never more than one digit before the point.
    it.each(['000', '000.00', '00', '00.00', '0000'])(
      'does not take %j for a zero: it is what a split thousands group leaves',
      (leftover) => {
        const row = `2026-10-01,House rent,18,${leftover},`
        const { transactions, errors } = parseTransactionsCsv(file(SPLIT, row), 'BDT')
        expect(transactions, row).toEqual([])
        expect(errors, row).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
      },
    )

    it('does not take 0,00 or 0.000 for a zero either', () => {
      // 0,00 is cut in two by its comma, so the row is longer than its columns with a non-empty
      // extra cell. 0.000 is not a number the reader accepts, so it is reported on its own.
      const shifted = parseTransactionsCsv(file(SPLIT, '2026-10-01,Rent,800,0,00'), 'BDT')
      expect(shifted.errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
      const odd = parseTransactionsCsv(file(SPLIT, '2026-10-01,Rent,800,0.000'), 'BDT')
      expect(odd.transactions).toEqual([])
      expect(odd.errors).toEqual<CsvError[]>([
        { row: 2, code: 'bad_amount', column: 'credit', value: '0.000' },
      ])
    })

    it('still catches a split thousands group in a file whose other rows write zeros', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(BALANCE, '2026-10-01,House rent,18,000,,', '2026-10-02,Salary,0.00,900.00,5900.00,'),
        'BDT',
      )
      expect(transactions.map((t) => t.id)).toEqual(['row-3'])
      expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
    })
  })

  it('counts a header padded with empty cells as only as wide as its last name', () => {
    // Spreadsheets pad every line to the widest one. The shifted row is as long as the padded
    // header, but the cell under the empty header is not empty.
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount,,', '2026-10-01,Salary credit,55,000,', '2026-10-02,Rent,-18000'),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([['row-3', -18000]])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'extra_cells' }])
  })

  it('does not mind extra cells in a blank row', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Good,-10', ',,,,,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(1)
  })
})

describe('parseTransactionsCsv: quotes', () => {
  it('reads a quoted field holding a comma and an escaped quote', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-03,"Shop, ""Best"" Dhaka",-100,,', '2026-10-04,Next,-20,,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => [t.id, t.description])).toEqual([
      ['row-2', 'Shop, "Best" Dhaka'],
      ['row-3', 'Next'],
    ])
  })

  it('imports the rows before an unclosed quote and reports it once, with the rows lost', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,Good one,-10,,', // row 2
        '2026-10-02,Good two,-20,,', // row 3
        '2026-10-03,"Unclosed shop,-30,,', // row 4: the quote that never closes
        '2026-10-04,Lost one,-40,,', // row 5
        '2026-10-05,Lost two,-50,,', // row 6
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-3'])
    expect(errors).toEqual<CsvError[]>([{ row: 4, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('reports the quote alone when it sits in the first data row', () => {
    // Not no_rows: the file has rows, they just cannot be read. And no clipped cell value
    // carrying the rest of the file.
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,Shop,"-5', '2026-10-02,Other,-6', '2026-10-03,Third,-7'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('says no rows were lost when the quote is on the last line', () => {
    for (const ending of ['', '\n']) {
      const { transactions, errors } = parseTransactionsCsv(
        `${file(HEADER, '2026-10-01,Good,-10,,', '2026-10-02,"Unclosed,-20,,')}${ending}`,
        'BDT',
      )
      expect(transactions.map((t) => t.id), JSON.stringify(ending)).toEqual(['row-2'])
      expect(errors, JSON.stringify(ending)).toEqual<CsvError[]>([
        { row: 3, code: 'bad_quotes', skippedRows: 0 },
      ])
    }
  })

  it('does not count blank lines among the rows lost', () => {
    const { errors } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,"Unclosed,-10,,',
        '',
        '2026-10-02,Lost one,-20,,',
        '   ',
        ',,,,',
        '2026-10-03,Lost two,-30,,',
        '',
      ),
      'BDT',
    )
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('counts the rows lost the same way with Windows line endings', () => {
    const lines = [HEADER, '2026-10-01,Good,-10,,', '2026-10-02,"Unclosed,-20,,', 'a,b,-1,,', 'c,d,-2,,']
    const { transactions, errors } = parseTransactionsCsv(lines.join('\r\n'), 'BDT')
    expect(transactions.map((t) => t.id)).toEqual(['row-2'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('counts the rows lost in a semicolon file, where ;;;; is a blank row', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date;description;amount',
        '2026-10-01;Good;-10',
        '2026-10-02;"Unclosed;-20',
        ';;;',
        '2026-10-03;Lost, with a comma;-30',
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('numbers the row as a spreadsheet does when an earlier cell has a line break', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        HEADER,
        '2026-10-01,"Two\nline note",-10,,', // row 2, over two lines
        '2026-10-02,"Unclosed,-20,,', // row 3
        '2026-10-03,Lost,-30,,',
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('still reports bad rows before the quote, then the quote', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,Bad amount,abc,,', '2026-10-02,Good,-20,,', '2026-10-03,"Unclosed,-30,,'),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-3'])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_amount', column: 'amount', value: 'abc' },
      { row: 4, code: 'bad_quotes', skippedRows: 0 },
    ])
  })

  it('reports an unclosed quote in the header as the only problem', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,"description,amount', '2026-10-01,Lost,-10', '2026-10-02,Lost,-20'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('numbers an unclosed quote in the header from the top of the file', () => {
    const { errors } = parseTransactionsCsv(file('', 'date,"description,amount', 'x'), 'BDT')
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('reports a file that is only a quote as an unclosed quote, not as empty', () => {
    expect(parseTransactionsCsv('"', 'BDT').errors).toEqual<CsvError[]>([
      { row: 1, code: 'bad_quotes', skippedRows: 0 },
    ])
  })

  it('gives a missing column, not the quote, when the header cannot be used anyway', () => {
    const { errors } = parseTransactionsCsv(
      file('date,description', '2026-10-01,"Unclosed', 'x'),
      'BDT',
    )
    expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'missing_column', column: 'amount' }])
  })
})

describe('parseTransactionsCsv: a runaway quote that a later quote closes by accident', () => {
  // The stray quote on row 3 opens a field that does not end on its line. The next quote in
  // the file is the opening quote of a good field on row 5, which the reader takes for the
  // closing quote, so the lines in between and part of row 5 become one cell. PapaParse says
  // so with InvalidQuotes, but it still hands back one merged record.
  const runaway = file(
    'date,description,amount',
    '2026-10-01,a,-5', // row 2
    '2026-10-02,"c,-7', // row 3: the stray quote
    '2026-10-03,d,-8', // swallowed
    '2026-10-04,"e",-9', // swallowed; its first quote closes the runaway field
    '2026-10-05,f,-10', // row 4: a spreadsheet shows the merged cell as one row
  )

  it('leaves the merged record out, reports it once and imports the rows after it', () => {
    const { transactions, errors } = parseTransactionsCsv(runaway, 'BDT')
    expect(transactions.map((t) => [t.id, t.date, t.description, t.amount])).toEqual([
      ['row-2', '2026-10-01', 'a', -5],
      ['row-4', '2026-10-05', 'f', -10],
    ])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('never turns the lost rows into a transaction with another row amount', () => {
    const { transactions } = parseTransactionsCsv(runaway, 'BDT')
    expect(transactions.map((t) => t.amount)).not.toContain(-7)
    expect(transactions.map((t) => t.amount)).not.toContain(-8)
    expect(transactions.map((t) => t.amount)).not.toContain(-9)
    expect(transactions.filter((t) => t.description.includes('\n'))).toEqual([])
  })

  it('reports one error for a record that PapaParse complains about twice', () => {
    // "Shop"x is a bad quote, and with no later quote the field also never ends.
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,Good,-10',
        '2026-10-02,"Shop"x,-20', // row 3
        '2026-10-03,Lost one,-30',
        '2026-10-04,Lost two,-40',
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('reports each broken record at its own row, in row order with the other row errors', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,Good one,-10', // row 2
        '2026-10-02,"One,-7', // row 3: broken, and swallows the next line
        '2026-10-03,"x",-8',
        '2026-10-04,Bad amount,abc', // row 4
        '2026-10-05,"Two,-7', // row 5: broken again
        '2026-10-06,"y",-9',
        '2026-10-07,Good two,-20', // row 6
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -10],
      ['row-6', -20],
    ])
    expect(errors).toEqual<CsvError[]>([
      { row: 3, code: 'bad_quotes', skippedRows: 1 },
      { row: 4, code: 'bad_amount', column: 'amount', value: 'abc' },
      { row: 5, code: 'bad_quotes', skippedRows: 1 },
    ])
  })

  it('leaves a record out even when its quote swallowed no other line', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount', '2026-10-01,Good,-10', '2026-10-02,"a"b",-5', '2026-10-03,Next,-20'),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-4'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 0 }])
  })

  it('reports the quote alone when the only data row is broken, not no_rows', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount', '2026-10-01,"a"b",-5'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 0 }])
  })

  it('reports a broken header as the only problem, not as a missing column', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,"desc"ription,amount', '2026-10-01,"x",-5', '2026-10-02,y,-6'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('does not count blank lines among the lines lost, and still counts them in row numbers', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,"Runaway,-10', // row 2
        '',
        '2026-10-02,Lost,-20',
        '   ',
        '2026-10-03,"Shut",-30',
        '', // row 3
        '2026-10-04,Good,-40', // row 4
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-4'])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('counts the lines lost the same way with Windows line endings', () => {
    const lines = [
      HEADER,
      '2026-10-01,Good,-10,,',
      '2026-10-02,"Runaway,-20,,', // row 3
      'a,b,-1,,',
      '2026-10-03,"Shut",-30,,',
      '2026-10-04,Fine,-40,,', // row 4
    ]
    const { transactions, errors } = parseTransactionsCsv(lines.join('\r\n'), 'BDT')
    expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-4'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('finds the same problem in a semicolon file, where ;;; is a blank line', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date;description;amount',
        '2026-10-01;Good;-10',
        '2026-10-02;"Runaway;-20', // row 3
        ';;;',
        '2026-10-03;"Shut";-30',
        '2026-10-04;Fine;-40', // row 4
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-2', 'row-4'])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('reports no broken quote in a well-formed file with quoted commas and escaped quotes', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,"Shop, ""Best"" Dhaka",-100',
        '2026-10-02,"Two\nline note",-20',
        '2026-10-03,"""Quoted"" at the start",-30',
        '2026-10-04,"Ends with a quote""",-40',
        '2026-10-05,"",-50',
        '"2026-10-06","Comma, semicolon; and ""both""",-60',
        '2026-10-07,"Last row, quoted",-70',
      ),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => [t.id, t.description, t.amount])).toEqual([
      ['row-2', 'Shop, "Best" Dhaka', -100],
      ['row-3', 'Two\nline note', -20],
      ['row-4', '"Quoted" at the start', -30],
      ['row-5', 'Ends with a quote"', -40],
      ['row-6', '', -50],
      ['row-7', 'Comma, semicolon; and "both"', -60],
      ['row-8', 'Last row, quoted', -70],
    ])
  })
})

describe('parseTransactionsCsv: a stray quote that a later quote closes at the end of a field', () => {
  // PapaParse sees nothing wrong here: the quote on row 3 opens a field, and the quote after
  // Monitor 24 closes it because a comma follows. The field is Eid shopping,-7 then a line
  // break then 2026-10-03,Monitor 24, so row 4 is inside it and the amount of the record is -8.
  const runaway = file(
    'date,description,amount',
    '2026-10-01,a,-5', // row 2
    '2026-10-02,"Eid shopping,-7', // row 3: the stray quote
    '2026-10-03,Monitor 24",-8', // swallowed; the quote at the end of Monitor 24 closes the field
    '2026-10-04,e,-9', // row 4
  )

  it('does not import the merged record, and reports it with the line it swallowed', () => {
    const { transactions, errors } = parseTransactionsCsv(runaway, 'BDT')
    expect(transactions.map((t) => [t.id, t.date, t.description, t.amount])).toEqual([
      ['row-2', '2026-10-01', 'a', -5],
      ['row-4', '2026-10-04', 'e', -9],
    ])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('does the same when the quoted cell is the last column', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,amount,description',
        '2026-10-01,-5,a',
        '2026-10-02,-7,"Eid shopping',
        '2026-10-03,-8,Monitor 24"',
        '2026-10-04,-9,e',
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -5],
      ['row-4', -9],
    ])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
  })

  it('counts every line the quote swallowed', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,a,-5',
        '2026-10-02,"Eid shopping,-7',
        '2026-10-03,Shirt,-8',
        '',
        '2026-10-04,Monitor 24",-9',
        '2026-10-05,e,-10',
      ),
      'BDT',
    )
    expect(transactions.map((t) => [t.id, t.amount])).toEqual([
      ['row-2', -5],
      ['row-4', -10],
    ])
    expect(errors).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 2 }])
  })

  it('recognises a swallowed row whose date has a time or spaces in front of it', () => {
    for (const swallowed of ['2026-10-03 14:03,Monitor 24"', '  31/10/2026,Monitor 24"']) {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount', '2026-10-02,"Eid shopping,-7', `${swallowed},-8`, '2026-10-04,e,-9'),
        'BDT',
      )
      expect(transactions.map((t) => t.id), swallowed).toEqual(['row-3'])
      expect(errors, swallowed).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 1 }])
    }
  })

  it('finds it in a semicolon file and with Windows line endings', () => {
    const semicolon = file(
      'date;description;amount',
      '2026-10-01;a;-5',
      '2026-10-02;"Eid shopping;-7',
      '2026-10-03;Monitor 24";-8',
      '2026-10-04;e;-9',
    )
    const crlf = runaway.replaceAll('\n', '\r\n')
    for (const [name, text] of [['semicolon', semicolon], ['crlf', crlf]] as const) {
      const { transactions, errors } = parseTransactionsCsv(text, 'BDT')
      expect(transactions.map((t) => t.id), name).toEqual(['row-2', 'row-4'])
      expect(errors, name).toEqual<CsvError[]>([{ row: 3, code: 'bad_quotes', skippedRows: 1 }])
    }
  })

  it('reports each such record at its own row, in row order with the other errors', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(
        'date,description,amount',
        '2026-10-01,"One,-7', // row 2
        '2026-10-02,Monitor 24",-8',
        '2026-10-03,Bad amount,abc', // row 3
        '2026-10-04,"Two,-7', // row 4
        '2026-10-05,Phone 5",-8',
        '2026-10-06,Good,-20', // row 5
      ),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-5'])
    expect(errors).toEqual<CsvError[]>([
      { row: 2, code: 'bad_quotes', skippedRows: 1 },
      { row: 3, code: 'bad_amount', column: 'amount', value: 'abc' },
      { row: 4, code: 'bad_quotes', skippedRows: 1 },
    ])
  })

  it('reports the quote alone when the only data row is the merged one', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount', '2026-10-02,"Eid shopping,-7', '2026-10-03,Monitor 24",-8'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'bad_quotes', skippedRows: 1 }])
  })

  describe('leaves a real multi-line quoted cell alone', () => {
    it.each([
      ['two plain lines', 'Eid shopping\nat the new market'],
      ['a second line that starts with a number', 'Eid shopping\n12 items, 3 bags'],
      ['a second line that is only a date', 'Eid shopping\n2026-10-03'],
      ['a date with no delimiter after it', 'Eid shopping\n2026-10-03 at the market'],
      ['a date later in the second line', 'Eid shopping\npaid on 2026-10-03, in cash'],
      ['a second line that starts with an unreal date', 'Eid shopping\n2026-02-30,Monitor 24'],
      ['three lines', 'Eid shopping\nline two\nline three'],
    ])('%s', (_name, description) => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount', `2026-10-02,"${description}",-7`, '2026-10-04,e,-9'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => [t.id, t.description, t.amount])).toEqual([
        ['row-2', description, -7],
        ['row-3', 'e', -9],
      ])
    })
  })
})

describe('parseTransactionsCsv: whole-file problems', () => {
  it('reports an empty file', () => {
    expect(parseTransactionsCsv('', 'BDT')).toEqual({
      transactions: [],
      errors: [{ row: 0, code: 'empty_file' }],
    })
  })

  it('treats a file of only blank lines and spaces as empty', () => {
    expect(parseTransactionsCsv('\n  \n\n', 'BDT').errors).toEqual<CsvError[]>([
      { row: 0, code: 'empty_file' },
    ])
    expect(parseTransactionsCsv('\u{FEFF}', 'BDT').errors).toEqual<CsvError[]>([
      { row: 0, code: 'empty_file' },
    ])
  })

  it('reports a header with no rows', () => {
    expect(parseTransactionsCsv(HEADER, 'BDT')).toEqual({
      transactions: [],
      errors: [{ row: 0, code: 'no_rows' }],
    })
    expect(parseTransactionsCsv(`${HEADER}\n\n,,,,\n`, 'BDT').errors).toEqual<CsvError[]>([
      { row: 0, code: 'no_rows' },
    ])
  })

  it('reports a file with neither an amount column nor a debit and credit pair', () => {
    expect(
      parseTransactionsCsv(file('date,description,currency', '2026-10-01,Test,BDT'), 'BDT'),
    ).toEqual({
      transactions: [],
      errors: [{ row: 1, code: 'missing_column', column: 'amount' }],
    })
  })

  describe('an amount column next to a column that says debit or credit', () => {
    // 500 with DR could be money out (the sign is in the other column) or the file may
    // mean -500 and DR is just a label. Reading it either way risks the wrong sign on every row.
    const rows = ['2026-10-01,Shwapno,500,DR', '2026-10-02,Salary,55000,CR']

    it('reports the column and imports nothing', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,amount,type', ...rows),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: 'type' }])
    })

    it.each([
      ['type', 'type'],
      ['Type', 'Type'],
      ['TYPE', 'TYPE'],
      ['  Type  ', 'Type'],
      ['dr/cr', 'dr/cr'],
      [' DR/CR ', 'DR/CR'],
      ['DRCR', 'DRCR'],
      ['dr_cr', 'dr_cr'],
      ['Dr_Cr', 'Dr_Cr'],
      ['transaction type', 'transaction type'],
      ['Transaction Type', 'Transaction Type'],
      ['Debit/Credit', 'Debit/Credit'],
      ['DEBIT/CREDIT', 'DEBIT/CREDIT'],
    ])('recognises the header %j and names it as written, %j', (header, shown) => {
      const { transactions, errors } = parseTransactionsCsv(
        file(`date,description,amount,${header}`, ...rows),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: shown }])
    })

    // Spaces and underscores around the slash and between words do not matter, and the pair is
    // as likely to be written the other way round (R34). The error names the header as written.
    it.each([
      ['Dr / Cr', 'Dr / Cr'],
      ['dr /cr', 'dr /cr'],
      ['DR/ CR', 'DR/ CR'],
      ['Dr  /  Cr', 'Dr  /  Cr'],
      ['dr _ cr', 'dr _ cr'],
      ['Dr_/_Cr', 'Dr_/_Cr'],
      ['cr/dr', 'cr/dr'],
      ['CR/DR', 'CR/DR'],
      ['Cr / Dr', 'Cr / Dr'],
      ['cr_dr', 'cr_dr'],
      ['CRDR', 'CRDR'],
      ['Debit / Credit', 'Debit / Credit'],
      ['DEBIT /CREDIT', 'DEBIT /CREDIT'],
      ['Credit/Debit', 'Credit/Debit'],
      ['Credit / Debit', 'Credit / Debit'],
      ['Debit_Credit', 'Debit_Credit'],
      ['transaction_type', 'transaction_type'],
      ['Transaction_Type', 'Transaction_Type'],
      ['TRANSACTION  TYPE', 'TRANSACTION  TYPE'],
      ['txn type', 'txn type'],
      ['Txn Type', 'Txn Type'],
      ['txn_type', 'txn_type'],
      ['  TXN_TYPE ', 'TXN_TYPE'],
    ])('also recognises the header %j and names it as written, %j', (header, shown) => {
      const { transactions, errors } = parseTransactionsCsv(
        file(`date,description,amount,${header}`, ...rows),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: shown }])
    })

    it('does not import 500 as money in when the file has a Dr / Cr column', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file('Date,Description,Amount,Dr / Cr', '2026-10-01,Shwapno,500,Dr', '2026-10-02,Salary,55000,Cr'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: 'Dr / Cr' }])
    })

    it('finds the column wherever it is', () => {
      const { errors } = parseTransactionsCsv(
        file('Type,Date,Description,Amount', 'DR,2026-10-01,Shwapno,500'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: 'Type' }])
    })

    it('reports it with a semicolon file', () => {
      const { errors } = parseTransactionsCsv(
        file('date;description;amount;dr/cr', '2026-10-01;Shwapno;500;DR'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: 'dr/cr' }])
    })

    it('reports it even when the file has no rows, or its rows cannot be read', () => {
      expect(parseTransactionsCsv('date,description,amount,type', 'BDT').errors).toEqual<CsvError[]>([
        { row: 1, code: 'direction_column', column: 'type' },
      ])
      expect(
        parseTransactionsCsv(file('date,description,amount,type', '2026-10-01,x,abc,DR'), 'BDT')
          .errors,
      ).toEqual<CsvError[]>([{ row: 1, code: 'direction_column', column: 'type' }])
    })

    it('numbers the header row from the top of the file', () => {
      const { errors } = parseTransactionsCsv(
        file('', 'date,description,amount,type', ...rows),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'direction_column', column: 'type' }])
    })

    it('reports each such column, after any missing column', () => {
      const { errors } = parseTransactionsCsv(file('date,amount,type,DR/CR', ...rows), 'BDT')
      expect(errors).toEqual<CsvError[]>([
        { row: 1, code: 'missing_column', column: 'description' },
        { row: 1, code: 'direction_column', column: 'type' },
        { row: 1, code: 'direction_column', column: 'DR/CR' },
      ])
    })

    it('leaves alone a file with debit and credit columns and a type column', () => {
      // The pair already says which way the money went, so there is no signed amount to doubt.
      const { transactions, errors } = parseTransactionsCsv(
        file('date,description,debit,credit,type', '2026-10-01,Shwapno,500,,Card'),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-500])
    })

    it('leaves alone other columns that merely resemble it', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,currency,category,balance,type of account,types',
          '2026-10-01,Shwapno,-500,,,1000,Savings,x',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions).toHaveLength(1)
    })

    it('leaves alone more columns that merely resemble it', () => {
      const names = [
        'transaction types',
        'transaction_type_code',
        'txn',
        'txn types',
        'type_of_account',
        'debit card',
        'credit_card',
        'dr',
        'cr',
        'dr/cr/x',
        'debit/credit/x',
      ]
      const { transactions, errors } = parseTransactionsCsv(
        file(`date,description,amount,${names.join(',')}`, `2026-10-01,Shwapno,-500,${names.map(() => 'x').join(',')}`),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions).toHaveLength(1)
    })
  })

  describe('a column name that appears twice', () => {
    it.each([
      'date',
      'description',
      'amount',
      'debit',
      'credit',
      'withdrawal',
      'deposit',
      'currency',
      'category',
    ])('reports a repeated %s column and imports nothing', (name) => {
      const { transactions, errors } = parseTransactionsCsv(
        file(`date,description,amount,${name},${name}`, '2026-10-01,Shwapno,-500,1,2'),
        'BDT',
      )
      expect(transactions).toEqual([])
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: name }])
    })

    it('matches names regardless of case and spaces, and names the column in lower case', () => {
      const { errors } = parseTransactionsCsv(
        file('Date, Amount ,description,AMOUNT', '2026-10-01,-500,Shwapno,-9'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: 'amount' }])
    })

    it('reports a name once however many times it appears, and each repeated name', () => {
      const { errors } = parseTransactionsCsv(
        file(
          'date,amount,date,description,amount,amount,date',
          '2026-10-01,-5,2026-10-02,x,-6,-7,2026-10-03',
        ),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([
        { row: 1, code: 'duplicate_column', column: 'date' },
        { row: 1, code: 'duplicate_column', column: 'amount' },
      ])
    })

    it('reports it with a missing column and a direction column, in that order', () => {
      const { errors } = parseTransactionsCsv(
        file('date,amount,amount,type', '2026-10-01,-5,-6,DR'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([
        { row: 1, code: 'missing_column', column: 'description' },
        { row: 1, code: 'duplicate_column', column: 'amount' },
        { row: 1, code: 'direction_column', column: 'type' },
      ])
    })

    it('numbers the header row from the top of the file', () => {
      const { errors } = parseTransactionsCsv(
        file('', 'date,description,amount,amount', '2026-10-01,x,-5,-6'),
        'BDT',
      )
      expect(errors).toEqual<CsvError[]>([{ row: 2, code: 'duplicate_column', column: 'amount' }])
    })

    // debit and withdrawal are two names for the one column, and so are credit and deposit.
    // With both in the header the reader would use one and ignore the other.
    describe('two names for the same column', () => {
      it.each([
        ['debit', 'withdrawal'],
        ['withdrawal', 'debit'],
        ['credit', 'deposit'],
        ['deposit', 'credit'],
      ])('reports %s together with %s, naming the second', (first, second) => {
        const { transactions, errors } = parseTransactionsCsv(
          file(`date,description,amount,${first},${second}`, '2026-10-01,Shwapno,-500,1,2'),
          'BDT',
        )
        expect(transactions).toEqual([])
        expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: second }])
      })

      it('names the second one as the file wrote it, trimmed', () => {
        expect(
          parseTransactionsCsv(file('date,description,Debit, Withdrawal ,Credit', '2026-10-01,x,5,,'), 'BDT')
            .errors,
        ).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: 'Withdrawal' }])
        expect(
          parseTransactionsCsv(file('date,description,WITHDRAWAL,DEBIT,Credit', '2026-10-01,x,5,,'), 'BDT')
            .errors,
        ).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: 'DEBIT' }])
      })

      it('reports it when the rest of the pair is there too, and imports nothing', () => {
        const { transactions, errors } = parseTransactionsCsv(
          file('date,description,debit,credit,withdrawal', '2026-10-01,Rent,500,,'),
          'BDT',
        )
        expect(transactions).toEqual([])
        expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: 'withdrawal' }])
      })

      it('reports both pairs in the order the second names appear', () => {
        const { errors } = parseTransactionsCsv(
          file('date,description,debit,credit,Deposit,withdrawal', '2026-10-01,Rent,500,,,'),
          'BDT',
        )
        expect(errors).toEqual<CsvError[]>([
          { row: 1, code: 'duplicate_column', column: 'Deposit' },
          { row: 1, code: 'duplicate_column', column: 'withdrawal' },
        ])
      })

      it('reports a second name once however many times it appears', () => {
        const { errors } = parseTransactionsCsv(
          file('date,description,amount,debit,withdrawal,withdrawal', '2026-10-01,x,-5,1,2,3'),
          'BDT',
        )
        expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'duplicate_column', column: 'withdrawal' }])
      })

      it('reports it alongside a repeated name, each in the order of its second appearance', () => {
        const { errors } = parseTransactionsCsv(
          file('date,description,amount,debit,amount,withdrawal,debit', '2026-10-01,x,-5,1,-6,2,3'),
          'BDT',
        )
        expect(errors).toEqual<CsvError[]>([
          { row: 1, code: 'duplicate_column', column: 'amount' },
          { row: 1, code: 'duplicate_column', column: 'withdrawal' },
          { row: 1, code: 'duplicate_column', column: 'debit' },
        ])
      })

      it('reports it after a missing column, on the header row', () => {
        const { errors } = parseTransactionsCsv(
          file('', 'date,Debit,Withdrawal', '2026-10-01,5,6'),
          'BDT',
        )
        expect(errors).toEqual<CsvError[]>([
          { row: 2, code: 'missing_column', column: 'description' },
          { row: 2, code: 'missing_column', column: 'amount' },
          { row: 2, code: 'duplicate_column', column: 'Withdrawal' },
        ])
      })

      it('leaves alone a debit with a deposit, or a withdrawal with a credit', () => {
        for (const header of [
          'date,description,debit,deposit',
          'date,description,withdrawal,credit',
          'date,description,withdrawal,deposit',
          'date,description,debit,credit',
        ]) {
          const { transactions, errors } = parseTransactionsCsv(
            file(header, '2026-10-01,Rent,500,', '2026-10-02,Pay,,900'),
            'BDT',
          )
          expect(errors, header).toEqual([])
          expect(transactions.map((t) => t.amount), header).toEqual([-500, 900])
        }
      })
    })

    it('does not mind a repeated name the reader does not use', () => {
      const { transactions, errors } = parseTransactionsCsv(
        file(
          'date,description,amount,balance,balance,,,notes,notes',
          '2026-10-01,Shwapno,-500,1,2,,,a,b',
        ),
        'BDT',
      )
      expect(errors).toEqual([])
      expect(transactions.map((t) => t.amount)).toEqual([-500])
    })
  })

  it('does not take half a pair for an amount column', () => {
    const { errors } = parseTransactionsCsv(
      file('date,description,debit', '2026-10-01,Test,10'),
      'BDT',
    )
    expect(errors).toEqual<CsvError[]>([{ row: 1, code: 'missing_column', column: 'amount' }])
  })

  it('reports each missing required column', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('when,what,amount', '2026-10-01,Test,10'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([
      { row: 1, code: 'missing_column', column: 'date' },
      { row: 1, code: 'missing_column', column: 'description' },
    ])
  })

  it('finds the header after leading blank lines, and numbers rows from the file', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file('', HEADER, '2026-10-01,Good,-10,,', '2026-10-02,Bad,abc,,'),
      'BDT',
    )
    expect(transactions.map((t) => t.id)).toEqual(['row-3'])
    expect(errors).toEqual<CsvError[]>([
      { row: 4, code: 'bad_amount', column: 'amount', value: 'abc' },
    ])
  })
})

describe('parseTransactionsCsv: size', () => {
  /** A file of `count` rows. Descriptions are all different, so none can be reused. */
  function bigFile(count: number): string {
    const lines = [HEADER]
    for (let i = 0; i < count; i++) {
      const month = String((i % 12) + 1).padStart(2, '0')
      const day = String((i % 28) + 1).padStart(2, '0')
      const description = ['Shwapno order', 'Foodpanda order', 'Unheard-of shop'][i % 3]
      lines.push(`2026-${month}-${day},${description} ${i},-${100 + (i % 900)},BDT,`)
    }
    return lines.join('\n')
  }

  it('exposes the row limit', () => {
    expect(MAX_ROWS).toBe(20_000)
  })

  it('reports a file with more than 20,000 rows and imports none of it', () => {
    const { transactions, errors } = parseTransactionsCsv(bigFile(MAX_ROWS + 1), 'BDT')
    expect(transactions).toEqual([])
    expect(errors).toEqual<CsvError[]>([{ row: 0, code: 'too_many_rows' }])
  })

  it('does not count blank lines towards the limit', () => {
    const text = `${bigFile(MAX_ROWS)}\n\n\n,,,,\n`
    const { transactions, errors } = parseTransactionsCsv(text, 'BDT')
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(MAX_ROWS)
  })

  it('parses 20,000 rows in under a second', () => {
    const text = bigFile(MAX_ROWS)
    const start = performance.now()
    const { transactions, errors } = parseTransactionsCsv(text, 'BDT')
    const elapsed = performance.now() - start
    expect(errors).toEqual([])
    expect(transactions).toHaveLength(MAX_ROWS)
    expect(elapsed).toBeLessThan(1000)
  })
})

describe('the downloadable template', () => {
  const { transactions, errors } = parseTransactionsCsv(template, 'BDT')

  it('parses without errors', () => {
    expect(errors).toEqual([])
    expect(transactions.length).toBeGreaterThanOrEqual(35)
  })

  it('covers three complete months, August to October 2026', () => {
    expect(completeMonths(transactions.map((t) => t.date))).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('has every row recognised, so the first score has nothing to ask the visitor to sort', () => {
    expect(transactions.filter((t) => t.category === 'uncategorised_out')).toEqual([])
    expect(transactions.filter((t) => t.unrecognisedIncome)).toEqual([])
  })

  it('is a salaried person in BDT, with some categories given and most left blank', () => {
    expect(new Set(transactions.map((t) => t.currency))).toEqual(new Set(['BDT']))
    const header = template.split(/\r?\n/)[0]
    expect(header).toBe(HEADER)

    const salary = transactions.filter((t) => t.category === 'salary')
    expect(salary.map((t) => t.amount)).toEqual([55000, 55000, 55000])

    const given = template
      .split(/\r?\n/)
      .slice(1)
      .filter((line) => line.trim() !== '' && !line.endsWith(','))
    expect(given.length).toBeGreaterThan(0)
    expect(given.length).toBeLessThan(transactions.length / 4)
  })

  it('shows the kinds of payment a Dhaka household makes', () => {
    const categories = new Set(transactions.map((t) => t.category))
    for (const expected of [
      'salary',
      'rent',
      'utilities',
      'groceries',
      'cash_withdrawal',
      'fees',
      'eating_out',
      'transport',
      'mobile_internet',
      'savings_deposit',
      'loan_emi',
    ] as const) {
      expect(categories, expected).toContain(expected)
    }
  })
})
