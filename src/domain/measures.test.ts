import { describe, expect, it } from 'vitest'
import { fixtureA, fixtureRates, tx } from './fixtures'
import { computeMeasures } from './measures'
import type { Dataset, Transaction } from './types'

function dataset(
  transactions: Transaction[],
  emergencySavings: Dataset['emergencySavings'] = null,
): Dataset {
  return { key: 'mine', transactions, emergencySavings }
}

/** The last day of a month given as `YYYY-MM`, as a `YYYY-MM-DD` date. */
function lastDayOf(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number]
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${String(day).padStart(2, '0')}`
}

describe('computeMeasures on fixtureA', () => {
  const measures = computeMeasures(fixtureA)

  it('uses the three complete months', () => {
    expect(measures.months).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('totals income, spending and debt payments over the period', () => {
    // Loan received (20,000) and the own-account transfers are not income or spending.
    expect(measures.income).toBe(153_000)
    // Rent, groceries, eating out and cash, less the 1,000 refund.
    expect(measures.spending).toBe(92_000)
    expect(measures.debtPayments).toBe(15_000)
    expect(measures.essentials).toBe(69_000)
    expect(measures.wants).toBe(18_000)
  })

  it('splits the totals by month', () => {
    const rest = { essentials: 23_000, wants: 6_000, debt: 5_000 }
    expect(measures.monthly).toEqual([
      { month: '2026-01', income: 50_000, spending: 31_000, ...rest },
      // The refund brings February spending down by 1,000.
      { month: '2026-02', income: 50_000, spending: 30_000, ...rest },
      // March has the extra 3,000 of unrecognised income.
      { month: '2026-03', income: 53_000, spending: 31_000, ...rest },
    ])
    expect(measures.monthly.map((month) => month.spending)).toEqual([31_000, 30_000, 31_000])
  })

  it('computes the savings rate, debt ratio and wants share', () => {
    expect(measures.savingsRate).toBeCloseTo(0.300654, 6) // (153000 - 92000 - 15000) / 153000
    expect(measures.debtRatio).toBeCloseTo(0.098039, 6) // 15000 / 153000
    expect(measures.wantsShare).toBeCloseTo(0.206897, 6) // 18000 / (69000 + 18000)
  })

  it('computes spending variability with the population standard deviation', () => {
    expect(measures.spendingCV).toBeCloseTo(0.015372, 6)
  })

  it('counts the emergency buffer in months of essentials', () => {
    expect(measures.bufferMonths).toBe(2) // 46000 / 23000
  })

  it('reports uncategorised spending and unrecognised income', () => {
    expect(measures.uncategorisedShare).toBe(0)
    expect(measures.unrecognisedIncomeCount).toBe(1)
  })

  it('averages spending categories per month', () => {
    expect(measures.categoryMonthlyAvg.eating_out).toBe(6_000)
    expect(measures.categoryMonthlyAvg.rent).toBe(15_000)
    expect(measures.categoryMonthlyAvg.groceries).toBe(8_000)
    expect(measures.categoryMonthlyAvg.cash_withdrawal).toBe(2_000)
  })

  it('leaves income, debt, savings, refunds and ignored money out of the category averages', () => {
    // The refund lowers total spending but belongs to no category.
    expect(Object.keys(measures.categoryMonthlyAvg).sort()).toEqual([
      'cash_withdrawal',
      'eating_out',
      'groceries',
      'rent',
    ])
  })
})

describe('computeMeasures edge cases', () => {
  it('gives no savings rate or debt ratio when there is no income', () => {
    const measures = computeMeasures(
      dataset([
        tx('2026-01-01', 'rent', -15_000),
        tx('2026-01-31', 'loan_emi', -5_000),
        tx('2026-02-01', 'rent', -15_000),
        tx('2026-02-28', 'loan_emi', -5_000),
        tx('2026-03-01', 'rent', -15_000),
        tx('2026-03-31', 'loan_emi', -5_000),
      ]),
    )

    expect(measures.income).toBe(0)
    expect(measures.savingsRate).toBeNull()
    expect(measures.debtRatio).toBeNull()
    // The measures that do not need income still work.
    expect(measures.spending).toBe(45_000)
    expect(measures.wantsShare).toBe(0)
    expect(measures.spendingCV).toBe(0)
  })

  it('keeps a negative savings rate when spending is more than income', () => {
    const measures = computeMeasures(
      dataset([tx('2026-01-01', 'salary', 10_000), tx('2026-01-31', 'shopping', -12_000)]),
    )

    expect(measures.savingsRate).toBeCloseTo(-0.2, 10)
  })

  it('gives no spending variability with fewer than 3 months', () => {
    const twoMonths = dataset(fixtureA.transactions.filter((t) => t.date < '2026-03-01'))
    const measures = computeMeasures(twoMonths)

    expect(measures.months).toEqual(['2026-01', '2026-02'])
    expect(measures.spendingCV).toBeNull()
    // Everything else is still calculated from the two months.
    expect(measures.income).toBe(100_000)
    expect(measures.spending).toBe(61_000)
    expect(measures.savingsRate).toBeCloseTo(0.29, 10) // (100000 - 61000 - 10000) / 100000
  })

  it('gives no spending variability when there is no spending to compare', () => {
    const measures = computeMeasures(
      dataset([
        tx('2026-01-01', 'salary', 50_000),
        tx('2026-01-31', 'savings_deposit', -5_000),
        tx('2026-02-01', 'salary', 50_000),
        tx('2026-02-28', 'savings_deposit', -5_000),
        tx('2026-03-01', 'salary', 50_000),
        tx('2026-03-31', 'savings_deposit', -5_000),
      ]),
    )

    expect(measures.spending).toBe(0)
    expect(measures.spendingCV).toBeNull()
  })

  it('gives no buffer when the visitor entered no savings', () => {
    const measures = computeMeasures({ ...fixtureA, emergencySavings: null })

    expect(measures.bufferMonths).toBeNull()
  })

  it('treats savings of zero as a buffer of zero months', () => {
    const measures = computeMeasures({
      ...fixtureA,
      emergencySavings: { amount: 0, currency: 'BDT' },
    })

    expect(measures.bufferMonths).toBe(0)
  })

  it('gives no buffer or wants share when there are no essentials or wants', () => {
    const measures = computeMeasures(
      dataset(
        [tx('2026-01-01', 'salary', 50_000), tx('2026-01-31', 'cash_withdrawal', -5_000)],
        { amount: 10_000, currency: 'BDT' },
      ),
    )

    expect(measures.essentials).toBe(0)
    expect(measures.wantsShare).toBeNull()
    expect(measures.bufferMonths).toBeNull()
  })

  it('converts other currencies to taka with the rates it is given', () => {
    const measures = computeMeasures(
      dataset(
        [
          tx('2026-01-01', 'salary', 100, { currency: 'USD' }), // 100 USD = 12,500 BDT
          tx('2026-01-31', 'groceries', -40, { currency: 'USD' }), // 5,000 BDT
        ],
        { amount: 10, currency: 'USD' }, // 1,250 BDT
      ),
      fixtureRates,
    )

    expect(measures.income).toBe(12_500)
    expect(measures.spending).toBe(5_000)
    expect(measures.essentials).toBe(5_000)
    expect(measures.categoryMonthlyAvg.groceries).toBe(5_000)
    expect(measures.bufferMonths).toBe(0.25) // 1250 / 5000
  })

  it('leaves a partial trailing month out of every total', () => {
    const withPartialApril = dataset([
      ...fixtureA.transactions,
      // April stops on the 10th, so it is not a complete month.
      tx('2026-04-01', 'salary', 50_000),
      tx('2026-04-05', 'other_income', 9_000, { unrecognisedIncome: true }),
      tx('2026-04-08', 'rent', -15_000),
      tx('2026-04-10', 'loan_emi', -5_000),
    ])
    const measures = computeMeasures({
      ...withPartialApril,
      emergencySavings: fixtureA.emergencySavings,
    })

    // Same result as without April: months, totals and the unrecognised-income count.
    expect(measures).toEqual(computeMeasures(fixtureA))
  })

  it('leaves a partial leading month out of every total', () => {
    const withPartialDecember = dataset([
      // December starts on the 20th, so it is not a complete month.
      tx('2025-12-20', 'rent', -15_000),
      tx('2025-12-28', 'salary', 50_000),
      ...fixtureA.transactions,
    ])
    const measures = computeMeasures({
      ...withPartialDecember,
      emergencySavings: fixtureA.emergencySavings,
    })

    expect(measures).toEqual(computeMeasures(fixtureA))
  })

  it('uses only the latest 12 complete months', () => {
    const transactions: Transaction[] = []
    // Fourteen months, January 2025 to February 2026.
    for (let index = 0; index < 14; index++) {
      const month = `${2025 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
      transactions.push(tx(`${month}-01`, 'salary', 1_000), tx(lastDayOf(month), 'rent', -500))
    }
    const measures = computeMeasures(dataset(transactions))

    expect(measures.months).toHaveLength(12)
    expect(measures.months[0]).toBe('2025-03')
    expect(measures.months[11]).toBe('2026-02')
    expect(measures.income).toBe(12_000)
    expect(measures.spending).toBe(6_000)
  })

  it('keeps uncategorised spending out of needs and wants but in total spending', () => {
    const measures = computeMeasures(
      dataset([
        tx('2026-01-01', 'salary', 50_000),
        tx('2026-01-10', 'groceries', -8_000),
        tx('2026-01-31', 'uncategorised_out', -2_000),
      ]),
    )

    expect(measures.spending).toBe(10_000)
    expect(measures.essentials).toBe(8_000)
    expect(measures.wants).toBe(0)
    expect(measures.uncategorisedShare).toBeCloseTo(0.2, 10)
    expect(measures.categoryMonthlyAvg.uncategorised_out).toBe(2_000)
  })

  it('counts gifts as spending that is neither a need nor a want', () => {
    const measures = computeMeasures(
      dataset([
        tx('2026-01-01', 'salary', 50_000),
        tx('2026-01-10', 'groceries', -8_000),
        tx('2026-01-31', 'gifts', -3_000),
      ]),
    )

    expect(measures.spending).toBe(11_000)
    expect(measures.essentials).toBe(8_000)
    expect(measures.wants).toBe(0)
    expect(measures.categoryMonthlyAvg.gifts).toBe(3_000)
  })

  it('returns empty, null measures for a dataset with no transactions', () => {
    const measures = computeMeasures(dataset([]))

    expect(measures.months).toEqual([])
    expect(measures.monthly).toEqual([])
    expect(measures.income).toBe(0)
    expect(measures.spending).toBe(0)
    expect(measures.categoryMonthlyAvg).toEqual({})
    expect(measures.savingsRate).toBeNull()
    expect(measures.debtRatio).toBeNull()
    expect(measures.wantsShare).toBeNull()
    expect(measures.spendingCV).toBeNull()
    expect(measures.bufferMonths).toBeNull()
    expect(measures.uncategorisedShare).toBe(0)
    expect(measures.unrecognisedIncomeCount).toBe(0)
  })

  it('returns no months when the only month is partial', () => {
    const measures = computeMeasures(
      dataset([tx('2026-01-12', 'salary', 50_000), tx('2026-01-15', 'rent', -15_000)], {
        amount: 30_000,
        currency: 'BDT',
      }),
    )

    expect(measures.months).toEqual([])
    expect(measures.income).toBe(0)
    expect(measures.savingsRate).toBeNull()
    expect(measures.bufferMonths).toBeNull()
  })
})
