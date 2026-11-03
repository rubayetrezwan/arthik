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
    expect(errors).toEqual<CsvError[]>([
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

  it('rejects a number too large to hold exactly', () => {
    expect(parseRow(`2026-10-01,Test,${'9'.repeat(400)},,`).errors).toEqual([
      expect.objectContaining({ row: 2, code: 'bad_amount' }),
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

  it('allows empty cells after the last column', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(THREE, '2026-10-01,Salary credit,55000,', '2026-10-02,Rent,-18000,,,', '2026-10-03,Tea,-12, ,  ,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([55000, -18000, -12])
  })

  it('allows an empty cell after a debit or credit that fills only one of the two', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(SPLIT, '2026-10-01,House rent,18000,,', '2026-10-02,Salary credit,,55000,'),
      'BDT',
    )
    expect(errors).toEqual([])
    expect(transactions.map((t) => t.amount)).toEqual([-18000, 55000])
  })

  it('counts a header padded with empty cells as only as wide as its last name', () => {
    // Spreadsheets pad every line to the widest one. The shifted row is as long as the padded
    // header, but the cell under the empty header is not empty.
    const { transactions, errors } = parseTransactionsCsv(
      file('date,description,amount,,', '2026-10-01,Salary credit,55,000,', '2026-10-02,Rent,-18000,,'),
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
