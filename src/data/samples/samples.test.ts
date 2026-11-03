import { describe, expect, it } from 'vitest'
import { buildDataset, type Persona } from '../../../scripts/samples/engine'
import { generateAll, serialise } from '../../../scripts/samples/generate'
import { groupOf } from '../../domain/categories'
import { categorize } from '../../domain/categorize'
import { computeMeasures } from '../../domain/measures'
import { completeMonths, monthOf } from '../../domain/period'
import { computeScore, type MeasureId } from '../../domain/score'
import type { CategoryId, PersonId, Transaction } from '../../domain/types'
import arifFile from './arif.json?raw'
import farhanaFile from './farhana.json?raw'
import { parseSample, PERSON_IDS, PERSON_META, SAMPLES } from './index'
import nusratFile from './nusrat.json?raw'
import rahimFile from './rahim.json?raw'
import tanvirFile from './tanvir.json?raw'

const MAY_TO_OCT = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']

/** Eid-ul-Adha 2026 falls on or about this day. */
const EID_ADHA = '2026-05-27'

const COMMITTED_FILES: Record<PersonId, string> = {
  nusrat: nusratFile,
  tanvir: tanvirFile,
  farhana: farhanaFile,
  arif: arifFile,
  rahim: rahimFile,
}

/** The score each person is built to land in (spec 6), both ends included. */
const SCORE_RANGES: Record<PersonId, [low: number, high: number]> = {
  nusrat: [60, 69],
  tanvir: [70, 79],
  farhana: [25, 39],
  arif: [50, 59],
  rahim: [80, 92],
}

const WANTS: readonly CategoryId[] = [
  'eating_out',
  'shopping',
  'entertainment',
  'travel',
  'personal_care',
]

function analyse(id: PersonId) {
  const measures = computeMeasures(SAMPLES[id])
  return { measures, result: computeScore(measures) }
}

function subScore(id: PersonId, measure: MeasureId): number | null {
  return analyse(id).result.lines.find((line) => line.id === measure)?.subScore ?? null
}

function inCategory(id: PersonId, category: CategoryId): Transaction[] {
  return SAMPLES[id].transactions.filter((transaction) => transaction.category === category)
}

function total(transactions: readonly Transaction[]): number {
  return transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
}

/** What some lines add up to in each month, May to October. */
function monthlyTotalsOf(transactions: readonly Transaction[]): number[] {
  return MAY_TO_OCT.map((month) =>
    total(transactions.filter((transaction) => monthOf(transaction.date) === month)),
  )
}

/** What a category adds up to in each month, May to October. Money out comes back negative. */
function monthlyTotals(id: PersonId, category: CategoryId): number[] {
  return monthlyTotalsOf(inCategory(id, category))
}

/**
 * Follows a wallet's balance line by line, from nothing: the lowest it gets and where it
 * ends. `belongs` picks the wallet's lines.
 */
function walletBalance(id: PersonId, belongs: (transaction: Transaction) => boolean) {
  let balance = 0
  let lowest = 0
  for (const transaction of SAMPLES[id].transactions.filter(belongs)) {
    balance += transaction.amount
    lowest = Math.min(lowest, balance)
  }
  return { lowest, final: balance }
}

/** True when the category has a payment in every one of the six months. */
function everyMonth(id: PersonId, category: CategoryId): boolean {
  return MAY_TO_OCT.every((month) =>
    inCategory(id, category).some((transaction) => monthOf(transaction.date) === month),
  )
}

/** What one wallet took in and paid out in a month, from the lines that name it. */
function walletFlow(id: PersonId, wallet: RegExp, month: string) {
  const lines = SAMPLES[id].transactions.filter(
    (transaction) => monthOf(transaction.date) === month && wallet.test(transaction.description),
  )
  const sum = (selected: Transaction[]) => total(selected)
  return {
    received: sum(lines.filter((line) => line.amount > 0)),
    paid: -sum(lines.filter((line) => line.amount < 0)),
  }
}

/** Lines in one month whose description mentions the merchant. */
function paidTo(id: PersonId, category: CategoryId, merchant: RegExp, month: string) {
  return inCategory(id, category).filter(
    (transaction) =>
      monthOf(transaction.date) === month && merchant.test(transaction.description),
  )
}

function largestWant(id: PersonId): CategoryId {
  const { categoryMonthlyAvg } = analyse(id).measures
  const spent = (category: CategoryId) => categoryMonthlyAvg[category] ?? 0
  return [...WANTS].sort((a, b) => spent(b) - spent(a))[0] as CategoryId
}

describe('the sample set', () => {
  it('lists the five people in order', () => {
    expect(PERSON_IDS).toEqual(['nusrat', 'tanvir', 'farhana', 'arif', 'rahim'])
    expect(Object.keys(SAMPLES).sort()).toEqual([...PERSON_IDS].sort())
  })

  it('gives each person a home currency', () => {
    expect(PERSON_META).toEqual({
      nusrat: { homeCurrency: 'BDT' },
      tanvir: { homeCurrency: 'BDT' },
      farhana: { homeCurrency: 'BDT' },
      arif: { homeCurrency: 'GBP' },
      rahim: { homeCurrency: 'SGD' },
    })
  })
})

describe.each(PERSON_IDS)('%s sample data', (id) => {
  const dataset = SAMPLES[id]
  const { transactions } = dataset

  it('is keyed by the person', () => {
    expect(dataset.key).toBe(id)
  })

  it('covers six complete months, May to October 2026', () => {
    const dates = transactions.map((transaction) => transaction.date)
    expect(completeMonths(dates)).toEqual(MAY_TO_OCT)
  })

  it('starts on 1 May and ends on 31 October', () => {
    const dates = transactions.map((transaction) => transaction.date)
    expect(dates[0]).toBe('2026-05-01')
    expect(dates.at(-1)).toBe('2026-10-31')
  })

  it('has unique ids, in date order', () => {
    const ids = transactions.map((transaction) => transaction.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const transactionId of ids) expect(transactionId).toMatch(new RegExp(`^${id}-\\d{4}$`))

    const keys = transactions.map((transaction) => `${transaction.date} ${transaction.id}`)
    expect(keys).toEqual([...keys].sort())
  })

  it('has a real-looking description and a non-zero amount in whole cents on every line', () => {
    for (const transaction of transactions) {
      expect(transaction.description.trim().length).toBeGreaterThan(5)
      expect(transaction.amount).not.toBe(0)
      expect(Math.round(transaction.amount * 100) / 100).toBe(transaction.amount)
    }
  })

  it('stores the category the categoriser gives its description', () => {
    for (const transaction of transactions) {
      const read = categorize(transaction.description, transaction.amount)
      expect(transaction.category, transaction.description).toBe(read.category)
      expect(Boolean(transaction.unrecognisedIncome), transaction.id).toBe(read.unrecognisedIncome)
    }
  })

  it('keeps some emergency savings, in the home currency', () => {
    expect(dataset.emergencySavings?.currency).toBe(PERSON_META[id].homeCurrency)
    expect(dataset.emergencySavings?.amount).toBeGreaterThan(0)
  })

  it('scores in its target range', () => {
    const [low, high] = SCORE_RANGES[id]
    const { result } = analyse(id)
    expect(result.status).toBe('scored')
    expect(result.months).toEqual(MAY_TO_OCT)
    expect(result.score).toBeGreaterThanOrEqual(low)
    expect(result.score).toBeLessThanOrEqual(high)
  })

  it('is exactly the file the generator writes', () => {
    // A checkout that turns line endings into CRLF should not fail this.
    const committed = COMMITTED_FILES[id].replace(/\r\n/g, '\n')
    expect(committed).toBe(serialise(generateAll()[id]))
  })
})

describe('what the five scores show', () => {
  it('reach all three bands', () => {
    const bands = PERSON_IDS.map((id) => analyse(id).result.band)
    expect(bands).toEqual(['coping', 'coping', 'vulnerable', 'coping', 'healthy'])
  })

  it("has Farhana earning over 2.5 times what Nusrat has coming in, and scoring lower", () => {
    const farhana = analyse('farhana')
    const nusrat = analyse('nusrat')
    expect(farhana.measures.income).toBeGreaterThan(2.5 * nusrat.measures.income)
    expect(farhana.result.score).toBeLessThan(nusrat.result.score ?? 0)
  })

  it('has Rahim send at least 40% of his income home and still score highest', () => {
    const { measures, result } = analyse('rahim')
    const sentHome = (measures.categoryMonthlyAvg.family_support_out ?? 0) * measures.months.length
    expect(sentHome / measures.income).toBeGreaterThanOrEqual(0.4)

    const scores = PERSON_IDS.map((id) => analyse(id).result.score ?? 0)
    expect(result.score).toBe(Math.max(...scores))
  })
})

describe('currencies', () => {
  it('has Tanvir paid in dollars and spending in taka', () => {
    const { transactions } = SAMPLES.tanvir
    const moneyIn = transactions.filter((transaction) => transaction.amount > 0)
    const moneyOut = transactions.filter((transaction) => transaction.amount < 0)
    expect(moneyIn.length).toBeGreaterThan(0)
    expect(moneyIn.every((transaction) => transaction.currency === 'USD')).toBe(true)
    expect(moneyOut.every((transaction) => transaction.currency === 'BDT')).toBe(true)
  })

  it.each([
    ['arif', 'GBP'],
    ['rahim', 'SGD'],
    ['nusrat', 'BDT'],
    ['farhana', 'BDT'],
  ] as const)('keeps %s entirely in %s', (id, currency) => {
    expect(SAMPLES[id].transactions.every((line) => line.currency === currency)).toBe(true)
  })
})

describe('Nusrat, student in Dhaka', () => {
  it('lives on about 23,000 taka a month: family allowance and tutoring', () => {
    const monthlyIncome = analyse('nusrat').measures.income / MAY_TO_OCT.length
    expect(monthlyIncome).toBeGreaterThan(22_000)
    expect(monthlyIncome).toBeLessThan(24_000)
    expect(everyMonth('nusrat', 'family_support_in')).toBe(true)
    expect(everyMonth('nusrat', 'side_income')).toBe(true)
    expect(inCategory('nusrat', 'salary')).toHaveLength(0)
  })

  it('pays 5,500 taka mess rent every month', () => {
    expect(monthlyTotals('nusrat', 'rent')).toEqual(Array(6).fill(-5_500))
  })

  it('owes nothing and keeps one to two months of essentials in reserve', () => {
    const { measures } = analyse('nusrat')
    expect(measures.debtPayments).toBe(0)
    expect(measures.bufferMonths).toBeGreaterThan(1)
    expect(measures.bufferMonths).toBeLessThan(2)
    expect(SAMPLES.nusrat.emergencySavings).toEqual({ amount: 15_000, currency: 'BDT' })
  })

  it('spends most on Foodpanda among her wants, with several orders a month', () => {
    expect(largestWant('nusrat')).toBe('eating_out')
    for (const month of MAY_TO_OCT) {
      expect(paidTo('nusrat', 'eating_out', /foodpanda/i, month).length, month).toBeGreaterThan(4)
    }
  })

  it('has each wallet pay out about what it takes in, month by month', () => {
    // Pocket money lands in bKash and tuition in Nagad. Neither wallet only receives or only pays.
    for (const wallet of [/bkash/i, /nagad/i]) {
      for (const month of MAY_TO_OCT) {
        const { received, paid } = walletFlow('nusrat', wallet, month)
        expect(received, `${String(wallet)} ${month}`).toBeGreaterThan(0)
        expect(paid / received, `${String(wallet)} ${month}`).toBeGreaterThan(0.85)
        expect(paid / received, `${String(wallet)} ${month}`).toBeLessThan(1.15)
      }
    }
  })

  it('goes home to Barishal for Eid-ul-Adha and spends nothing that only works in Dhaka', () => {
    const tickets = inCategory('nusrat', 'transport').filter((line) => /bus ticket/i.test(line.description))
    const there = tickets.find((line) => /dhaka-barishal/i.test(line.description))
    const back = tickets.find((line) => /barishal-dhaka/i.test(line.description))
    expect(tickets).toHaveLength(2)
    // Bought a few days before Eid, and the way back bought after it.
    expect(there && there.date >= '2026-05-20' && there.date < EID_ADHA).toBe(true)
    expect(back && back.date > EID_ADHA && back.date <= '2026-05-31').toBe(true)

    // Rides, the metro and shops in Mirpur: none while she is in Barishal.
    const dhakaOnly = /pathao|mrt|foodpanda|chaldal|shwapno|lazz|bella|daraz/i
    const whileAway = SAMPLES.nusrat.transactions.filter(
      (line) => line.date >= '2026-05-23' && line.date <= '2026-05-30',
    )
    expect(whileAway.length).toBeGreaterThan(0)
    expect(whileAway.filter((line) => dhakaOnly.test(line.description))).toEqual([])
    // ...and she does use them in Dhaka either side of the trip.
    const inDhaka = (from: string, to: string) =>
      SAMPLES.nusrat.transactions.filter(
        (line) => line.date >= from && line.date <= to && dhakaOnly.test(line.description),
      )
    expect(inDhaka('2026-05-01', '2026-05-22').length).toBeGreaterThan(5)
    expect(inDhaka('2026-06-01', '2026-06-30').length).toBeGreaterThan(5)
  })

  it('pays about 18.50 taka per 1,000 she takes out as cash, as a separate charge', () => {
    const cashOuts = inCategory('nusrat', 'cash_withdrawal')
    const charges = inCategory('nusrat', 'fees').filter((line) =>
      /cash out/i.test(line.description),
    )
    expect(cashOuts.length).toBeGreaterThan(6)
    expect(charges).toHaveLength(cashOuts.length)
    expect(total(charges) / total(cashOuts)).toBeCloseTo(0.0185, 3)
  })
})

describe('Tanvir, freelance developer in Dhaka', () => {
  it('is paid in dollars through Payoneer, a different amount each month', () => {
    expect(everyMonth('tanvir', 'freelance')).toBe(true)
    expect(inCategory('tanvir', 'salary')).toHaveLength(0)
    expect(inCategory('tanvir', 'freelance').every((line) => /payoneer/i.test(line.description)))
      .toBe(true)

    const income = monthlyTotals('tanvir', 'freelance')
    expect(Math.min(...income)).toBeGreaterThanOrEqual(800)
    expect(Math.max(...income)).toBeLessThanOrEqual(2_000)
    // Irregular: the best month brings in at least 1.6 times the worst.
    expect(Math.max(...income)).toBeGreaterThanOrEqual(1.6 * Math.min(...income))
  })

  it('puts the same amount into a DPS every month and owes nothing', () => {
    const dps = monthlyTotals('tanvir', 'savings_deposit')
    expect(dps.every((amount) => amount < 0)).toBe(true)
    expect(new Set(dps).size).toBe(1)
    expect(analyse('tanvir').measures.debtPayments).toBe(0)
  })

  it('has uneven spending: its swings are over a quarter of its average', () => {
    expect(analyse('tanvir').measures.spendingCV).toBeGreaterThan(0.25)
  })

  it('buys a PlayStation in August, a want and not a work tool, and sends Eid salami', () => {
    const august = SAMPLES.tanvir.transactions.filter((line) => monthOf(line.date) === '2026-08')
    const [biggest] = [...august].sort((a, b) => a.amount - b.amount)
    expect(biggest?.description).toMatch(/playstation/i)
    expect(groupOf(biggest?.category ?? 'uncategorised_out')).toBe('want')
    expect(biggest?.amount).toBeLessThan(-70_000)
    expect(SAMPLES.tanvir.transactions.some((line) => /laptop|macbook|computer/i.test(line.description)))
      .toBe(false)

    const salami = inCategory('tanvir', 'gifts')
    expect(salami).toHaveLength(1)
    expect(salami[0] && salami[0].date >= '2026-05-20' && salami[0].date < EID_ADHA).toBe(true)
  })

  it('has every dollar payment worded the way Payoneer words it, "Payment from ..."', () => {
    for (const line of inCategory('tanvir', 'freelance')) {
      expect(line.description, line.id).toMatch(/^Payoneer - Payment from [A-Z]/)
    }
  })
})

describe('Farhana, office worker in Dhaka', () => {
  it('is paid 65,000 taka a month and pays 22,000 rent', () => {
    const pay = inCategory('farhana', 'salary').filter((line) => /^salary/i.test(line.description))
    expect(monthlyTotalsOf(pay)).toEqual(Array(6).fill(65_000))
    expect(monthlyTotals('farhana', 'rent')).toEqual(Array(6).fill(-22_000))
  })

  it('gets a festival bonus before Eid, and Eid costs her more than the bonus', () => {
    // The word "bonus" is what makes the categoriser read it as salary.
    const bonus = inCategory('farhana', 'salary').filter((line) => /bonus/i.test(line.description))
    expect(bonus).toHaveLength(1)
    expect(bonus[0]?.date.startsWith('2026-05')).toBe(true)
    expect(bonus[0] && bonus[0].date < EID_ADHA).toBe(true)

    // From the day the bonus lands to the day after Eid: the qurbani share sent to her mother,
    // Eid clothes and salami.
    const eidLines = SAMPLES.farhana.transactions.filter(
      (line) => line.date >= (bonus[0]?.date ?? '') && line.date <= '2026-05-28',
    )
    const qurbani = eidLines.filter((line) => /qurbani/i.test(line.description))
    expect(qurbani).toHaveLength(1)
    expect(qurbani[0]?.category).toBe('family_support_out')
    const eidSpending = total(
      eidLines.filter((line) =>
        ['family_support_out', 'gifts', 'shopping'].includes(line.category),
      ),
    )
    expect(-eidSpending).toBeGreaterThan(bonus[0]?.amount ?? Infinity)

    // Salami goes out close to Eid itself.
    const salami = inCategory('farhana', 'gifts')
    expect(salami.length).toBeGreaterThanOrEqual(2)
    for (const line of salami) {
      expect(line.date >= '2026-05-24' && line.date <= EID_ADHA, line.id).toBe(true)
    }
  })

  it('covers part of what she overspends with two loans from a relative, which are not income', () => {
    const loans = inCategory('farhana', 'loan_received')
    expect(loans).toHaveLength(2)
    for (const loan of loans) {
      expect(loan.amount).toBeGreaterThan(0)
      expect(loan.description).toMatch(/loan from shila apa/i)
    }
    // Everything counted as income is her pay: six salaries and the bonus.
    expect(analyse('farhana').measures.income).toBe(6 * 65_000 + 20_000)
    // The borrowing is smaller than what she overspends by, so it does not hide the gap.
    const { measures } = analyse('farhana')
    const gap = -(measures.income - measures.spending - measures.debtPayments)
    expect(gap).toBeGreaterThan(total(loans))
  })

  it('pays a 12,000 taka loan EMI and a credit card bill every month', () => {
    expect(monthlyTotals('farhana', 'loan_emi')).toEqual(Array(6).fill(-12_000))
    expect(everyMonth('farhana', 'card_payment')).toBe(true)
  })

  it('gives over 30% of her income to debt payments', () => {
    expect(analyse('farhana').measures.debtRatio).toBeGreaterThan(0.3)
  })

  it('pays DESCO and Titas Gas every month', () => {
    for (const month of MAY_TO_OCT) {
      expect(paidTo('farhana', 'utilities', /desco/i, month).length, month).toBeGreaterThan(0)
      expect(paidTo('farhana', 'utilities', /titas/i, month).length, month).toBeGreaterThan(0)
    }
  })

  it('shops on Daraz, paid by bKash, more than she spends on anything else she wants', () => {
    expect(largestWant('farhana')).toBe('shopping')
    const shopping = inCategory('farhana', 'shopping')
    const daraz = shopping.filter((line) => /daraz/i.test(line.description))
    expect(daraz.length).toBeGreaterThanOrEqual(18)
    expect(total(daraz) / total(shopping)).toBeGreaterThan(0.8)
    expect(shopping.every((line) => /bkash/i.test(line.description))).toBe(true)
  })

  it('tops up bKash from her bank every month, which is neither income nor spending', () => {
    expect(everyMonth('farhana', 'own_transfer')).toBe(true)
    expect(monthlyTotals('farhana', 'own_transfer')).toEqual(Array(6).fill(0))
  })

  it('keeps enough in bKash to pay from it: the balance never goes below zero or piles up', () => {
    // The bank's side of a top-up also says "bKash", so it is left out.
    const bkash = (line: Transaction) =>
      /bkash/i.test(line.description) && !/^add money to bkash/i.test(line.description)
    const { lowest, final } = walletBalance('farhana', bkash)
    expect(lowest).toBe(0)
    expect(final).toBeLessThan(10_000)
    expect(SAMPLES.farhana.transactions.filter(bkash).some((line) => line.amount < 0)).toBe(true)
  })

  it('spends more than she earns once debt payments are counted, with almost no reserve', () => {
    const { measures } = analyse('farhana')
    expect(measures.savingsRate).toBeLessThan(0)
    expect(measures.bufferMonths).toBeLessThan(0.5)
  })
})

describe('Arif, MSc student in the UK', () => {
  it('lives on part-time wages and family support, with no debt', () => {
    expect(everyMonth('arif', 'salary')).toBe(true)
    expect(everyMonth('arif', 'family_support_in')).toBe(true)
    expect(analyse('arif').measures.debtPayments).toBe(0)
  })

  it('pays rent, shops at Tesco and travels on TfL every month', () => {
    expect(everyMonth('arif', 'rent')).toBe(true)
    for (const month of MAY_TO_OCT) {
      expect(paidTo('arif', 'groceries', /tesco/i, month).length, month).toBeGreaterThan(0)
      expect(paidTo('arif', 'transport', /tfl/i, month).length, month).toBeGreaterThan(0)
    }
  })

  it('puts a modest amount aside every month: under 10% of income', () => {
    expect(everyMonth('arif', 'savings_deposit')).toBe(true)
    const saved = -total(inCategory('arif', 'savings_deposit'))
    const wages = total(inCategory('arif', 'salary'))
    const income = wages + total(inCategory('arif', 'family_support_in'))
    expect(saved).toBeGreaterThan(0)
    expect(saved / income).toBeLessThan(0.1)
  })

  it('gets family support as a round sum in pounds from abroad, and a ticket home in August', () => {
    const support = inCategory('arif', 'family_support_in')
    for (const line of support) {
      expect(line.description, line.id).toMatch(/^INTERNATIONAL PAYMENT FROM /)
      expect(line.amount % 50, line.id).toBe(0)
    }
    expect(support.filter((line) => /ticket/i.test(line.description)).map((line) => line.date))
      .toEqual(['2026-08-02'])
  })

  it('rents a room: a fixed rent and a fixed share of the bills, with no energy or water direct debits', () => {
    expect(monthlyTotals('arif', 'rent')).toEqual(Array(6).fill(-780))
    expect(monthlyTotals('arif', 'utilities')).toEqual(Array(6).fill(-70))
    for (const line of inCategory('arif', 'rent')) {
      expect(line.description, line.id).toMatch(/^STANDING ORDER TO [A-Z] [A-Z]+ - /)
    }
    const statement = SAMPLES.arif.transactions.map((line) => line.description).join('\n')
    // No energy, water or broadband direct debits, and no street address in a payee.
    expect(statement).not.toMatch(/direct debit|octopus|thames|virgin media|\b\d+ [A-Z]+ RD\b/i)
  })

  it('has a different reference on every Spotify and Amazon line, in the shape those firms use', () => {
    const spotify = SAMPLES.arif.transactions.filter((line) => /spotify/i.test(line.description))
    const amazon = SAMPLES.arif.transactions.filter((line) => /amazon/i.test(line.description))
    expect(spotify).toHaveLength(6)
    expect(amazon.length).toBeGreaterThan(0)
    for (const line of spotify) expect(line.description).toMatch(/^SPOTIFY P[0-9A-F]{8} STOCKHOLM$/)
    for (const line of amazon) {
      expect(line.description).toMatch(/^AMAZON\.CO\.UK\*[A-Z0-9]{9} AMZNMKTPLACE$/)
    }
    expect(new Set(spotify.map((line) => line.description)).size).toBe(spotify.length)
    expect(new Set(amazon.map((line) => line.description)).size).toBe(amazon.length)
  })

  it('has dinner out on Eid-ul-Adha', () => {
    const dinner = inCategory('arif', 'eating_out').filter((line) => line.date === EID_ADHA)
    expect(dinner.some((line) => /biryani/i.test(line.description))).toBe(true)
  })
})

describe('Rahim, construction worker in Singapore', () => {
  it('is paid 1,500 Singapore dollars every month and pays no rent', () => {
    expect(monthlyTotals('rahim', 'salary')).toEqual(Array(6).fill(1_500))
    expect(inCategory('rahim', 'rent')).toHaveLength(0)
  })

  it('sends about 700 dollars home every month', () => {
    for (const sent of monthlyTotals('rahim', 'family_support_out')) {
      expect(-sent).toBeGreaterThan(650)
      expect(-sent).toBeLessThan(750)
    }
  })

  it('spends very steadily and owes nothing', () => {
    expect(subScore('rahim', 'stability')).toBeGreaterThanOrEqual(80)
    expect(analyse('rahim').measures.debtPayments).toBe(0)
  })

  it('saves something every month', () => {
    expect(everyMonth('rahim', 'savings_deposit')).toBe(true)
    expect(analyse('rahim').measures.savingsRate).toBeGreaterThan(0.1)
  })
})

describe('the generator', () => {
  it('gives identical output when run twice', () => {
    expect(JSON.stringify(generateAll())).toBe(JSON.stringify(generateAll()))
  })

  it('writes indented JSON with a final newline', () => {
    const text = serialise(generateAll().rahim)
    expect(text.endsWith('}\n')).toBe(true)
    expect(text).toContain('\n  "transactions": [\n')
  })

  describe('with a small config', () => {
    const persona: Persona = {
      id: 'rahim',
      seed: 1,
      currency: 'SGD',
      emergencySavings: 100,
      monthly: [
        { day: 1, category: 'salary', description: 'SALARY', amount: 1_500 },
        { day: 'last', category: 'rent', description: 'ROOM RENT', amount: -300 },
      ],
      scattered: [],
    }

    it('numbers the lines in date order and ends on the last day', () => {
      const { transactions } = buildDataset(persona)
      expect(transactions).toHaveLength(12)
      expect(transactions.slice(0, 3).map((line) => line.id)).toEqual([
        'rahim-0001',
        'rahim-0002',
        'rahim-0003',
      ])
      expect(transactions.at(-1)?.date).toBe('2026-10-31')
    })

    it('stops when the categoriser reads a line differently from the config', () => {
      const wrong: Persona = {
        ...persona,
        monthly: [
          ...persona.monthly,
          { day: 3, category: 'salary', description: 'ROOM RENT', amount: -5 },
        ],
      }
      expect(() => buildDataset(wrong)).toThrow(/"ROOM RENT".*meant to be salary.*as rent/)
    })

    it('stops when the lines do not run from 1 May to 31 October', () => {
      const late: Persona = {
        ...persona,
        monthly: [{ day: 2, category: 'salary', description: 'SALARY', amount: 1_500 }],
      }
      expect(() => buildDataset(late)).toThrow(/1 May to 31 October/)
    })

    it('keeps a scattered item out of its skipped dates', () => {
      const away: Persona = {
        ...persona,
        scattered: [
          {
            perMonth: [20, 20],
            category: 'transport',
            description: 'PATHAO RIDE',
            amount: -100,
            skipBetween: ['2026-05-20', '2026-05-31'],
          },
        ],
      }
      const rides = buildDataset(away).transactions.filter((line) => line.category === 'transport')
      expect(rides.some((line) => line.date >= '2026-05-20' && line.date <= '2026-05-31')).toBe(false)
      // May has 19 of its 31 days open, so 20 rides become 12; the other months keep 20.
      expect(rides.filter((line) => line.date.startsWith('2026-05'))).toHaveLength(12)
      expect(rides.filter((line) => line.date.startsWith('2026-06'))).toHaveLength(20)
      expect(rides).toHaveLength(112)
    })

    it('folds a provider fee into one payment when asked to', () => {
      const remittance: Persona = {
        ...persona,
        monthly: [
          ...persona.monthly,
          {
            day: 5,
            category: 'family_support_out',
            description: 'FAST PAYMENT TO INSTAREM PTE LTD',
            amount: -500,
            feeIncluded: 0.007,
          },
        ],
      }
      const { transactions } = buildDataset(remittance)
      const sent = transactions.filter((line) => line.category === 'family_support_out')
      expect(sent.map((line) => line.amount)).toEqual(Array(6).fill(-503.5))
      expect(transactions.some((line) => line.category === 'fees')).toBe(false)
    })

    it('adds the other side of a transfer between two accounts of one person', () => {
      const topUp: Persona = {
        ...persona,
        monthly: [
          ...persona.monthly,
          {
            day: 2,
            category: 'own_transfer',
            description: 'ADD MONEY TO BKASH',
            mirror: 'BKASH ADD MONEY FROM BANK',
            amount: [-12_000, -8_000],
            roundTo: 1_000,
          },
        ],
      }
      const { transactions } = buildDataset(topUp)
      const moves = transactions.filter((line) => line.category === 'own_transfer')
      expect(moves).toHaveLength(12)
      for (let index = 0; index < moves.length; index += 2) {
        const [out, back] = [moves[index], moves[index + 1]]
        expect(out?.description).toBe('ADD MONEY TO BKASH')
        expect(back?.description).toBe('BKASH ADD MONEY FROM BANK')
        expect(out?.date).toBe(back?.date)
        expect((out?.amount ?? 0) + (back?.amount ?? 0)).toBe(0)
        expect(out?.amount).toBeLessThan(0)
      }
    })

    it('draws a fresh code for each placeholder on each line', () => {
      const codes: Persona = {
        ...persona,
        scattered: [
          {
            perMonth: [2, 2],
            category: 'entertainment',
            description: 'SPOTIFY {hex} STOCKHOLM',
            amount: -5.99,
          },
          {
            perMonth: [2, 2],
            category: 'shopping',
            description: 'AMAZON.CO.UK*{code} AMZNMKTPLACE',
            amount: -20,
          },
        ],
      }
      const { transactions } = buildDataset(codes)
      const spotify = transactions.filter((line) => line.category === 'entertainment')
      const amazon = transactions.filter((line) => line.category === 'shopping')
      for (const line of spotify) expect(line.description).toMatch(/^SPOTIFY [0-9A-F]{8} STOCKHOLM$/)
      for (const line of amazon) {
        expect(line.description).toMatch(/^AMAZON\.CO\.UK\*[A-Z0-9]{9} AMZNMKTPLACE$/)
      }
      expect(new Set(spotify.map((line) => line.description)).size).toBeGreaterThan(6)
      expect(new Set(amazon.map((line) => line.description)).size).toBeGreaterThan(6)
    })
  })
})

describe('parseSample', () => {
  const valid = {
    key: 'rahim',
    emergencySavings: { amount: 100, currency: 'SGD' },
    transactions: [
      {
        id: 'rahim-0001',
        date: '2026-05-01',
        description: 'INWARD GIRO SALARY',
        amount: 1500,
        currency: 'SGD',
        category: 'salary',
      },
    ],
  }

  it('accepts a well-formed file', () => {
    expect(parseSample('rahim', valid).transactions).toHaveLength(1)
  })

  it('rejects a file for another person', () => {
    expect(() => parseSample('arif', valid)).toThrow(/arif/)
  })

  it('rejects an unknown category or currency', () => {
    const line = valid.transactions[0]
    const withCategory = { ...valid, transactions: [{ ...line, category: 'pocket_money' }] }
    const withCurrency = { ...valid, transactions: [{ ...line, currency: 'XYZ' }] }
    expect(() => parseSample('rahim', withCategory)).toThrow(/category/)
    expect(() => parseSample('rahim', withCurrency)).toThrow(/currency/)
  })

  it('rejects a date that is not YYYY-MM-DD', () => {
    const line = valid.transactions[0]
    const bad = { ...valid, transactions: [{ ...line, date: '1 May 2026' }] }
    expect(() => parseSample('rahim', bad)).toThrow(/date/)
  })
})
