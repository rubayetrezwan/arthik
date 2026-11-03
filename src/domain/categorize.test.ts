import { describe, expect, it } from 'vitest'
import { CATEGORIES, categoriesFor } from './categories'
import { categorize, RULES } from './categorize'
import type { CategoryId } from './types'

// [description, amount, expected category, expected unrecognisedIncome (default false)]
type Case = [description: string, amount: number, category: CategoryId, unrecognised?: boolean]

// Every table below is also fed to the direction invariant at the bottom.
const allCases: Case[] = []

function table(name: string, cases: Case[]) {
  allCases.push(...cases)
  describe(name, () => {
    it.each(cases)('categorises "%s" (%d) as %s', (description, amount, category, unrecognised) => {
      expect(categorize(description, amount)).toEqual({
        category,
        unrecognisedIncome: unrecognised ?? false,
      })
    })
  })
}

// The Task 7 brief, verbatim.
table('brief cases', [
  ['bKash Cash Out to Agent 01712345678', -4000, 'cash_withdrawal'],
  ['bKash cash-out charge', -74, 'fees'],
  ['Cash Out Charge', -18.5, 'fees'],
  ['ATM withdrawal', -2000, 'cash_withdrawal'],
  ['Foodpanda order Kacchi Bhai', -640, 'eating_out'],
  ['DESCO prepaid electricity', -1500, 'utilities'],
  ['Titas Gas bill', -1080, 'utilities'],
  ['Chaldal.com groceries', -1240, 'groceries'],
  ['Shwapno', -900, 'groceries'],
  ['Pathao ride', -185, 'transport'],
  ['Grameenphone internet pack', -499, 'mobile_internet'],
  ['Daraz order', -2300, 'shopping'],
  ['Netflix', -800, 'entertainment'],
  ['SALARY OCT ACME LTD', 65000, 'salary'],
  ['বেতন', 65000, 'salary'],
  ['Payoneer transfer Upwork', 1200, 'freelance'],
  ['Remittance from Singapore', 60000, 'remittance_in'],
  ['Received from 01712345678', 5000, 'other_income', true],
  ['Send Money to 01812345678', -3000, 'uncategorised_out'],
  ['Personal loan EMI', -12000, 'loan_emi'],
  ['Credit card bill payment', -9000, 'card_payment'],
  ['DPS installment', -2000, 'savings_deposit'],
  ['Sanchayapatra purchase', -50000, 'investments'],
  ['Add Money from bank', 5000, 'own_transfer'],
  ['Cash In from agent', 3000, 'cash_deposit'],
  ['Refund Daraz', 500, 'refund'],
  ['Tesco Stores', -25.4, 'groceries'],
  ['TfL travel', -2.8, 'transport'],
  ['NTUC FairPrice', -40, 'groceries'],
  ['Western Union to Bangladesh', -700, 'family_support_out'],
  ['XYZ 123', -100, 'uncategorised_out'],
])

describe('direction', () => {
  it('does not treat money out as salary', () => {
    // "Salary" is an inflow keyword, so an outflow must never get the salary category.
    const result = categorize('Salary', -500)
    expect(result.category).not.toBe('salary')
    expect(result).toEqual({ category: 'uncategorised_out', unrecognisedIncome: false })
  })

  it('only lets merchants categorise money out', () => {
    // A bare merchant name on an inflow is not a refund, so it stays unrecognised income.
    expect(categorize('Foodpanda', 640)).toEqual({ category: 'other_income', unrecognisedIncome: true })
    expect(categorize('Tesco Stores', 25.4)).toEqual({ category: 'other_income', unrecognisedIncome: true })
  })

  it('lets an own-account transfer go either way', () => {
    expect(categorize('Add Money to bKash', -5000).category).toBe('own_transfer')
    expect(categorize('Add Money from bank', 5000).category).toBe('own_transfer')
  })

  it('treats a zero amount as an uncategorised outflow, never as unrecognised income', () => {
    const expected = { category: 'uncategorised_out', unrecognisedIncome: false }
    expect(categorize('Salary', 0)).toEqual(expected)
    expect(categorize('Received from 01712345678', 0)).toEqual(expected)
    expect(categorize('Foodpanda', -0)).toEqual(expected)
  })
})

describe('matching', () => {
  it('ignores case', () => {
    for (const description of ['FOODPANDA ORDER', 'foodpanda order', 'FoodPanda Order']) {
      expect(categorize(description, -300).category, description).toBe('eating_out')
    }
  })

  it('reads cash-out however it is spelled', () => {
    const spellings = [
      'bKash Cash Out',
      'bKash cash-out',
      'bKash cashout',
      'BKASH  CASH   OUT',
      'bkash_cash_out',
      'bKash Cash\u2013Out',
    ]
    for (const description of spellings) {
      expect(categorize(description, -1000).category, description).toBe('cash_withdrawal')
      expect(categorize(`${description} charge`, -18).category, `${description} charge`).toBe('fees')
    }
  })

  it('reads cash-in however it is spelled', () => {
    for (const description of ['Nagad Cash In', 'Nagad Cash-In', 'Nagad cashin']) {
      expect(categorize(description, 1000).category, description).toBe('cash_deposit')
    }
  })

  it('ignores straight and curly apostrophes', () => {
    for (const description of ["Sainsbury's", 'Sainsbury\u2019s', 'SAINSBURYS', 'SAINSBURY S 1234']) {
      expect(categorize(description, -30).category, description).toBe('groceries')
    }
    expect(categorize('McDonald\u2019s', -8).category).toBe('eating_out')
    expect(categorize("Domino's Pizza", -12).category).toBe('eating_out')
  })

  it('ignores zero-width characters inside a word', () => {
    // Pasted text, and some Bengali keyboards, leave zero-width joiners and spaces in the middle
    // of words. Built from code points so no invisible character sits in the source.
    const zwj = String.fromCodePoint(0x200d)
    const zwsp = String.fromCodePoint(0x200b)
    expect(categorize(`বিদ্যু${zwj}ৎ বিল`, -1500).category).toBe('utilities')
    expect(categorize(`Food${zwsp}panda`, -420).category).toBe('eating_out')
  })

  it('does not match a keyword inside a longer word', () => {
    // "rent" inside "parent", "atm" inside "batman", "emi" inside "chemist" must not fire.
    expect(categorize('Parent teacher meeting', -100).category).toBe('uncategorised_out')
    expect(categorize('Batman tickets', -100).category).toBe('uncategorised_out')
    expect(categorize('Demi Moore fan club', -100).category).toBe('uncategorised_out')
  })
})

describe('order of rules', () => {
  it('puts fees and charges before cash-out', () => {
    expect(categorize('bKash cash-out charge', -74).category).toBe('fees')
    expect(categorize('bKash Cash Out to Agent', -4000).category).toBe('cash_withdrawal')
    expect(categorize('ATM fee', -17).category).toBe('fees')
    expect(categorize('ATM withdrawal fee', -17).category).toBe('fees')
    expect(categorize('Non-sterling transaction fee', -0.8).category).toBe('fees')
  })

  it('puts refunds before merchants and before the other money-in rules', () => {
    expect(categorize('Refund Daraz', 500).category).toBe('refund')
    expect(categorize('Daraz refund', 500).category).toBe('refund')
    expect(categorize('Foodpanda reversal', 640).category).toBe('refund')
    expect(categorize('Daraz order', -2300).category).toBe('shopping')
    // These also contain an income, interest or transfer-service keyword.
    expect(categorize('Tuition fee refund', 3000).category).toBe('refund')
    expect(categorize('Interest refund', 40).category).toBe('refund')
    expect(categorize('Upwork refund', 25).category).toBe('refund')
    expect(categorize('Wise refund', 25).category).toBe('refund')
  })

  it('puts Add Money and Cash In before generic income', () => {
    expect(categorize('Add Money from bank salary account', 5000).category).toBe('own_transfer')
    expect(categorize('Cash In from agent', 3000).category).toBe('cash_deposit')
  })

  it('keeps income and interest ahead of savings withdrawals', () => {
    expect(categorize('Salary credited to savings account', 65000).category).toBe('salary')
    expect(categorize('DPS interest', 800).category).toBe('other_income')
  })

  it('reads "card payment to" as a purchase, not a card bill', () => {
    // UK banks label every debit-card purchase this way.
    expect(categorize('Card payment to Greggs', -3.2).category).toBe('eating_out')
    expect(categorize('CARD PAYMENT TO THAMES WATER', -30).category).toBe('utilities')
    expect(categorize('Card payment to Boots', -6.5).category).toBe('healthcare')
    expect(categorize('Card payment to Tesco', -41).category).toBe('groceries')
    expect(categorize('Card payment to XYZ Ltd', -41).category).toBe('uncategorised_out')
    expect(categorize('Credit card bill payment', -9000).category).toBe('card_payment')
    expect(categorize('Visa card bill', -9000).category).toBe('card_payment')
  })

  it('keeps a card or loan fee a fee', () => {
    expect(categorize('Credit card annual fee', -1150).category).toBe('fees')
    expect(categorize('Credit card late payment fee', -500).category).toBe('fees')
    expect(categorize('Loan processing fee', -2000).category).toBe('fees')
  })

  it('does not match a brand prefix inside another name', () => {
    expect(categorize('Dominion Theatre', -45).category).toBe('entertainment')
    expect(categorize("Nando's", -14).category).toBe('eating_out')
    expect(categorize('Walton Road parking', -3).category).toBe('transport')
    expect(categorize('WALTON-ON-THAMES', -20).category).toBe('uncategorised_out')
  })

  it('puts debt rules before merchants', () => {
    expect(categorize('Tesco Bank', -150).category).toBe('card_payment')
    expect(categorize('Daraz PayLater', -1200).category).toBe('bnpl')
    expect(categorize('Daraz EMI', -1200).category).toBe('loan_emi')
  })

  it('lets a sub-brand win over its parent brand', () => {
    expect(categorize('Pathao Food', -450).category).toBe('eating_out')
    expect(categorize('Pathao', -150).category).toBe('transport')
    expect(categorize('Uber Eats', -18).category).toBe('eating_out')
    expect(categorize('UBER *EATS pending', -18).category).toBe('eating_out')
    expect(categorize('Uber trip', -9).category).toBe('transport')
    expect(categorize('GrabFood', -14).category).toBe('eating_out')
    expect(categorize('Grab* A-5XYZ', -11).category).toBe('transport')
    expect(categorize('GrabMart', -23).category).toBe('groceries')
    expect(categorize('Foodpanda pandamart', -820).category).toBe('groceries')
    expect(categorize('Foodpanda', -420).category).toBe('eating_out')
    expect(categorize('Tesco Mobile', -12).category).toBe('mobile_internet')
    expect(categorize('Tesco Stores', -12).category).toBe('groceries')
    expect(categorize('Amazon Prime', -8.99).category).toBe('entertainment')
    expect(categorize('Amazon Fresh', -41).category).toBe('groceries')
    expect(categorize('Amazon.co.uk', -41).category).toBe('shopping')
    expect(categorize('Apple Store', -999).category).toBe('shopping')
    expect(categorize('APPLE.COM/BILL', -2.99).category).toBe('entertainment')
  })

  it('does not read a bare recharge as a phone top-up', () => {
    // Oyster, EZ-Link and a prepaid electricity meter are all "recharged" too.
    expect(categorize('Prepaid meter recharge', -1000).category).toBe('utilities')
    expect(categorize('Oyster recharge', -20).category).toBe('transport')
    expect(categorize('EZ-Link recharge', -20).category).toBe('transport')
    expect(categorize('Mobile recharge', -100).category).toBe('mobile_internet')
  })

  it('lets a specific fee belong to its category before the generic fee rule', () => {
    expect(categorize('Tuition fee', -15000).category).toBe('education')
    expect(categorize('School fee Oct', -4000).category).toBe('education')
    expect(categorize('Monthly account maintenance charge', -100).category).toBe('fees')
    expect(categorize('Annual card fee', -1150).category).toBe('fees')
  })
})

table('Bengali', [
  ['বেতন', 65000, 'salary'],
  ['অক্টোবরের বেতন জমা', 65000, 'salary'],
  ['Office বেতন Oct', 65000, 'salary'],
  ['বেতন', -500, 'uncategorised_out'],
  ['বাসা ভাড়া', -15000, 'rent'],
  ['বাসা ভাড়া - অক্টোবর', -15000, 'rent'],
  ['ভাড়া', -8000, 'rent'],
  // ড় written as one code point (U+09DC) and as ড + nukta (U+09A1 U+09BC).
  ['\u09AD\u09BE\u09DC\u09BE', -8000, 'rent'],
  ['\u09AD\u09BE\u09A1\u09BC\u09BE', -8000, 'rent'],
  ['বিদ্যুৎ বিল', -1500, 'utilities'],
  ['বিদ্যুত বিল', -1500, 'utilities'],
  // Tuition is money in for the tutor and an education cost for the payer.
  ['টিউশন', 8000, 'side_income'],
  ['টিউশন ফি', -3000, 'education'],
  ['টিউশন ফি', 3000, 'side_income'],
])

table('Bangladesh wallets, cash and fees', [
  ['bKash Cash Out', -2000, 'cash_withdrawal'],
  ['Nagad CashOut to agent', -3000, 'cash_withdrawal'],
  ['Rocket Cash Out', -1000, 'cash_withdrawal'],
  ['Upay cash-out', -500, 'cash_withdrawal'],
  ['DBBL ATM Cash Withdrawal', -5000, 'cash_withdrawal'],
  ['bKash cash out fee', -18.5, 'fees'],
  ['Nagad cash-out charge', -14, 'fees'],
  ['VAT on charges', -3, 'fees'],
  ['Excise duty', -500, 'fees'],
  ['Annual card fee', -1150, 'fees'],
  ['Monthly account maintenance charge', -100, 'fees'],
  ['Nagad Add Money', 2000, 'own_transfer'],
  ['Add Money to bKash', -2000, 'own_transfer'],
  ['bKash to bank', -2000, 'own_transfer'],
  ['Transfer to own account', -10000, 'own_transfer'],
  ['Nagad Cash-In', 1000, 'cash_deposit'],
  ['Cash deposit CDM', 10000, 'cash_deposit'],
  ['ATM deposit', 10000, 'cash_deposit'],
  ['bKash Add Money charge', -10, 'fees'],
])

table('utilities', [
  ['DPDC bill payment', -1800, 'utilities'],
  ['NESCO electricity', -900, 'utilities'],
  ['Palli Bidyut bill', -450, 'utilities'],
  ['Dhaka WASA bill', -600, 'utilities'],
  ['Karnaphuli Gas', -975, 'utilities'],
  ['Bakhrabad Gas Distribution', -975, 'utilities'],
  ['LPG cylinder', -1450, 'utilities'],
  ['British Gas', -62, 'utilities'],
  ['Thames Water', -34, 'utilities'],
  ['Octopus Energy', -88, 'utilities'],
  ['SP Services', -95, 'utilities'],
  ['Electricity bill', -120, 'utilities'],
])

table('rent and housing', [
  ['House rent', -15000, 'rent'],
  ['Rent', -650, 'rent'],
  ['Flat rent Oct', -22000, 'rent'],
  ['Council tax', -145, 'rent'],
  ['Landlord', -600, 'rent'],
  ['Rent a car', -60, 'travel'],
  ['Car rental', -60, 'travel'],
])

table('mobile and internet', [
  ['Robi recharge', -100, 'mobile_internet'],
  ['Banglalink data pack', -299, 'mobile_internet'],
  ['Teletalk', -50, 'mobile_internet'],
  ['Link3 broadband', -1000, 'mobile_internet'],
  ['Mobile recharge', -100, 'mobile_internet'],
  ['Singtel', -45, 'mobile_internet'],
  ['StarHub', -38, 'mobile_internet'],
  ['M1 Limited', -30, 'mobile_internet'],
  ['Vodafone', -20, 'mobile_internet'],
  ['EE Limited', -22, 'mobile_internet'],
  ['Tesco Mobile', -12, 'mobile_internet'],
])

table('groceries', [
  ['Agora', -1500, 'groceries'],
  ['Meena Bazar', -2100, 'groceries'],
  ['Meena Bazaar', -2100, 'groceries'],
  ['Prince Bazar', -800, 'groceries'],
  ['Kacha Bazar', -400, 'groceries'],
  ['Unimart', -900, 'groceries'],
  ['Sainsbury\u2019s Local', -14.2, 'groceries'],
  ['Asda Superstore', -52, 'groceries'],
  ['Lidl GB', -19.9, 'groceries'],
  ['Aldi', -31, 'groceries'],
  ['Sheng Siong', -22, 'groceries'],
  ['Cold Storage', -35, 'groceries'],
  ['Supermarket', -500, 'groceries'],
])

table('transport', [
  ['Uber trip', -9, 'transport'],
  ['Shohoz bus ticket', -700, 'transport'],
  ['Oyster top-up', -20, 'transport'],
  ['National Rail', -35, 'transport'],
  ['Transport for London', -5.6, 'transport'],
  ['EZ-Link top up', -20, 'transport'],
  ['SimplyGo', -1.4, 'transport'],
  ['Grab ride', -11, 'transport'],
  ['Octane fuel', -2000, 'transport'],
  ['Rickshaw fare', -60, 'transport'],
])

table('eating out', [
  ['KFC', -850, 'eating_out'],
  ['Deliveroo', -18, 'eating_out'],
  ['Just Eat', -21, 'eating_out'],
  ['Starbucks', -5, 'eating_out'],
  ['Pizza Hut', -1200, 'eating_out'],
  ['Kacchi Bhai', -640, 'eating_out'],
  ['Hungry Naki', -300, 'eating_out'],
  ['Cafe Rio', -450, 'eating_out'],
])

table('shopping, entertainment and personal care', [
  ['Aarong', -3400, 'shopping'],
  ['Amazon', -29, 'shopping'],
  ['Lazada', -45, 'shopping'],
  ['Shopee', -12, 'shopping'],
  ['Spotify', -9.99, 'entertainment'],
  ['YouTube Premium', -12, 'entertainment'],
  ['Google Play', -4.99, 'entertainment'],
  ['Star Cineplex', -800, 'entertainment'],
  ['Gym membership', -3000, 'personal_care'],
  ['Watsons', -18, 'personal_care'],
  ['Salon', -1500, 'personal_care'],
])

table('travel, health, education, gifts', [
  ['Biman Bangladesh Airlines', -22000, 'travel'],
  ['Singapore Airlines', -450, 'travel'],
  ['Booking.com', -120, 'travel'],
  ['Cox\u2019s Bazar hotel', -6000, 'travel'],
  ['Coxs Bazar trip', -6000, 'travel'],
  ["Cox's Bazaar", -6000, 'travel'],
  ['Lazz Pharma', -420, 'healthcare'],
  ['Square Hospital', -3500, 'healthcare'],
  ['Boots Pharmacy', -7.5, 'healthcare'],
  ['Dental clinic', -2000, 'healthcare'],
  ['University fee', -30000, 'education'],
  ['Udemy', -12, 'education'],
  ['Zakat', -2500, 'gifts'],
  ['Donation to BRAC', -1000, 'gifts'],
  ['Eid salami', -1500, 'gifts'],
])

table('income', [
  ['Part-time wages', 820, 'salary'],
  ['Payroll', 2100, 'salary'],
  ['Upwork', 900, 'freelance'],
  ['Fiverr', 120, 'freelance'],
  ['Freelance project', 30000, 'freelance'],
  ['Tuition income', 8000, 'side_income'],
  ['Family allowance', 15000, 'family_support_in'],
  ['Pocket money from Abbu', 5000, 'family_support_in'],
  ['Western Union', 20000, 'remittance_in'],
  ['Wise', 500, 'remittance_in'],
  ['Remitly', 400, 'remittance_in'],
  ['Remittance to Bangladesh', -1000, 'family_support_out'],
  ['Remitly', -300, 'family_support_out'],
  ['WorldRemit', -300, 'family_support_out'],
  ['Transfer to Ammu', -5000, 'family_support_out'],
  ['Bank interest', 12, 'other_income'],
  ['Sanchayapatra profit', 3000, 'other_income'],
  ['Loan disbursement', 200000, 'loan_received'],
  ['Loan from friend', 5000, 'loan_received'],
  ['DPS maturity', 120000, 'savings_withdrawal'],
  ['Sanchayapatra encashment', 50000, 'savings_withdrawal'],
  ['Transfer from savings', 10000, 'savings_withdrawal'],
])

table('debt, savings and investments', [
  ['Home loan EMI', -25000, 'loan_emi'],
  ['Car loan installment', -18000, 'loan_emi'],
  ['Loan repayment', -5000, 'loan_emi'],
  ['Loan to Rafiq', -5000, 'uncategorised_out'],
  ['Barclaycard', -150, 'card_payment'],
  ['Amex bill', -120, 'card_payment'],
  ['Credit card payment', -9000, 'card_payment'],
  ['Klarna', -35, 'bnpl'],
  ['Atome', -40, 'bnpl'],
  ['Daraz PayLater', -1200, 'bnpl'],
  ['DPS', -2000, 'savings_deposit'],
  ['Fixed deposit', -100000, 'savings_deposit'],
  ['FD placement', -500, 'savings_deposit'],
  ['Transfer to savings account', -300, 'savings_deposit'],
  ['Mutual fund', -5000, 'investments'],
  ['Sanchay patra', -50000, 'investments'],
])

describe('categorize', () => {
  it('never puts money in a category of the wrong direction', () => {
    const incoming = new Set<CategoryId>(categoriesFor('in'))
    const outgoing = new Set<CategoryId>(categoriesFor('out'))
    for (const [description] of allCases) {
      const gained = categorize(description, 100)
      const spent = categorize(description, -100)
      expect(incoming.has(gained.category), `"${description}" as money in: ${gained.category}`).toBe(true)
      expect(outgoing.has(spent.category), `"${description}" as money out: ${spent.category}`).toBe(true)
      expect(spent.unrecognisedIncome, `"${description}" as money out`).toBe(false)
      if (gained.unrecognisedIncome) expect(gained.category).toBe('other_income')
    }
  })

  it('handles an empty description', () => {
    expect(categorize('', 100)).toEqual({ category: 'other_income', unrecognisedIncome: true })
    expect(categorize('   ', -100)).toEqual({ category: 'uncategorised_out', unrecognisedIncome: false })
  })
})

describe('RULES', () => {
  const info = new Map(CATEGORIES.map((category) => [category.id, category]))

  it('is not empty', () => {
    expect(RULES.length).toBeGreaterThan(50)
  })

  it('only assigns a category whose direction fits the rule direction', () => {
    for (const rule of RULES) {
      const category = info.get(rule.category)
      expect(category, `unknown category "${rule.category}"`).toBeDefined()
      const label = `${String(rule.pattern)} -> ${rule.category} (rule: ${rule.direction}, category: ${category?.direction})`
      if (rule.direction === 'any') {
        // A rule that fires on both signs may only assign a category that allows both.
        expect(category?.direction, label).toBe('any')
      } else {
        expect(['any', rule.direction], label).toContain(category?.direction)
      }
    }
  })

  it('uses only case-insensitive, stateless patterns', () => {
    // A g or y flag would make test() remember lastIndex and skip matches.
    for (const rule of RULES) {
      expect(rule.pattern.flags, String(rule.pattern)).toBe('i')
    }
  })

  it('never matches an empty description', () => {
    // Catches an empty alternative such as /foo|/ that would catch everything.
    for (const rule of RULES) {
      expect(rule.pattern.test(''), String(rule.pattern)).toBe(false)
      expect(rule.pattern.test(' '), String(rule.pattern)).toBe(false)
    }
  })

  it('writes Bengali in composed form and never next to a word boundary', () => {
    const bengali = /[ঀ-৿]/
    const nextToBoundary = /[ঀ-৿]\\b|\\b[ঀ-৿]/
    let sawBengali = false
    for (const rule of RULES) {
      const source = rule.pattern.source
      expect(source, String(rule.pattern)).toBe(source.normalize('NFC'))
      if (bengali.test(source)) {
        sawBengali = true
        // \b only knows ASCII word characters, so it never matches beside Bengali.
        expect(nextToBoundary.test(source), String(rule.pattern)).toBe(false)
      }
    }
    expect(sawBengali).toBe(true)
  })
})
