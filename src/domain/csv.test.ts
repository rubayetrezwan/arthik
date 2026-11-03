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

  it('keeps an unclosed quote from flooding an error with the rest of the file', () => {
    const { transactions, errors } = parseTransactionsCsv(
      file(HEADER, '2026-10-01,Shop,"-5', '2026-10-02,Other,-6', '2026-10-03,Third,-7'),
      'BDT',
    )
    expect(transactions).toEqual([])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toMatchObject({ row: 2, code: 'bad_amount', column: 'amount' })
    expect(errors[0]?.value?.length).toBeLessThanOrEqual(41)
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
