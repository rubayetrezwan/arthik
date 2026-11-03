// The five sample people (spec 6). Names and numbers are fictional; merchants are real
// so the statements read like the real thing. Money out is negative.
//
// The amounts are tuned so each person lands in the band the sample is there to show:
// the score reads habits, not income. The tests in src/data/samples hold them to it.

import type { Persona } from './engine'

/** bKash charges about 18.50 taka per 1,000 taken out as cash. */
const BKASH_CASH_OUT_RATE = 0.0185

/** An online remittance service takes well under 1% on a few hundred dollars. */
const REMITTANCE_FEE_RATE = 0.007

/** Eid-ul-Adha 2026 falls on or about Wednesday 27 May. Nusrat is at her family's home in Barishal. */
const NUSRAT_AT_HOME = ['2026-05-23', '2026-05-30'] as const

export const NUSRAT: Persona = {
  // University student sharing a mess in Mirpur. About 23,000 taka comes in: 15,000 pocket
  // money from her father, into bKash, and 8,000 from two tuition students, into Nagad. Each
  // wallet pays out about what it takes in, so neither one only receives or only pays.
  //
  // Eid-ul-Adha: Eid clothes from Aarong on 20 May, a bus home to Barishal on 23 May (ticket
  // bought on the 21st), back in Dhaka on 30 May (ticket bought on the 28th). While she is
  // away she uses nothing that only works in Dhaka: no rides, no MRT, no Foodpanda.
  id: 'nusrat',
  seed: 1088,
  currency: 'BDT',
  emergencySavings: 15_000,
  monthly: [
    {
      day: 1,
      category: 'family_support_in',
      description: 'bKash Received Money 01711xxxxxx - Pocket money',
      amount: 15_000,
    },
    {
      day: 2,
      category: 'rent',
      description: 'bKash Send Money 01819xxxxxx - Mess rent',
      amount: -5_500,
    },
    {
      day: 6,
      category: 'savings_deposit',
      description: 'Nagad Payment - DPS Instalment, Dutch-Bangla Bank A/C xx3321',
      amount: -500,
    },
    {
      day: 10,
      jitterDays: 2,
      category: 'side_income',
      description: 'Nagad Received 01811xxxxxx - Tuition fee',
      amount: 4_500,
    },
    {
      // A 30-day data pack at its fixed price.
      day: 12,
      jitterDays: 3,
      category: 'mobile_internet',
      description: 'Nagad Mobile Recharge - Robi 30GB 30 Days Pack 01812xxxxxx',
      amount: -499,
    },
    {
      day: 15,
      category: 'entertainment',
      description: 'Spotify Premium Student - bKash Payment',
      amount: -129,
    },
    {
      day: 'last',
      category: 'side_income',
      description: 'Nagad Received 01911xxxxxx - Tuition',
      amount: 3_500,
    },
    {
      day: 20,
      inMonths: [7, 10],
      category: 'education',
      description: 'University Exam Fee, Semester Final - bKash Payment',
      amount: -1_500,
    },
    {
      day: 12,
      inMonths: [9],
      category: 'healthcare',
      description: 'Smile Dental Care, Mirpur 10 - Nagad Payment',
      amount: [-2_500, -1_500],
      roundTo: 500,
    },
    {
      day: 20,
      inMonths: [5],
      category: 'shopping',
      description: 'AARONG, Mirpur - bKash Payment',
      amount: [-2_800, -1_800],
      roundTo: 50,
    },
    {
      day: 21,
      inMonths: [5],
      category: 'transport',
      description: 'Shohoz.com Bus Ticket Dhaka-Barishal - Nagad Payment',
      amount: -1_150,
    },
    {
      day: 26,
      inMonths: [5],
      category: 'gifts',
      description: 'bKash Send Money 01715xxxxxx - Eid salami',
      amount: -1_000,
    },
    {
      // Cash for Eid at home, from the bKash agent near her family's house.
      day: 24,
      inMonths: [5],
      category: 'cash_withdrawal',
      description: 'bKash Cash Out - Agent 01734xxxxxx',
      amount: -1_000,
      charge: { description: 'bKash Cash Out Charge', rate: BKASH_CASH_OUT_RATE },
    },
    {
      day: 28,
      inMonths: [5],
      category: 'transport',
      description: 'Shohoz.com Bus Ticket Barishal-Dhaka - Nagad Payment',
      amount: -1_000,
    },
  ],
  scattered: [
    {
      perMonth: [10, 13],
      skipBetween: NUSRAT_AT_HOME,
      category: 'eating_out',
      description: 'Foodpanda Order #FP{ref} - bKash Payment',
      amount: [-600, -200],
    },
    {
      perMonth: [1, 2],
      skipBetween: NUSRAT_AT_HOME,
      category: 'groceries',
      description: 'Chaldal.com Order #{ref} - Nagad Payment',
      amount: [-1_800, -600],
    },
    {
      perMonth: [2, 3],
      skipBetween: NUSRAT_AT_HOME,
      category: 'groceries',
      description: 'Nagad Payment - Shwapno Mirpur 10',
      amount: [-900, -250],
    },
    {
      perMonth: [4, 7],
      skipBetween: NUSRAT_AT_HOME,
      category: 'transport',
      description: 'Pathao Ride #{ref} - Nagad Payment',
      amount: [-260, -90],
    },
    {
      perMonth: [2, 3],
      skipBetween: NUSRAT_AT_HOME,
      category: 'transport',
      description: 'Nagad Payment - MRT Rapid Pass Recharge, Mirpur 10 Station',
      amount: [-500, -300],
      roundTo: 100,
    },
    {
      perMonth: [2, 3],
      category: 'cash_withdrawal',
      description: 'bKash Cash Out - Agent 01712xxxxxx',
      amount: [-2_000, -500],
      roundTo: 500,
      charge: { description: 'bKash Cash Out Charge', rate: BKASH_CASH_OUT_RATE },
    },
    {
      perMonth: [1, 1],
      skipBetween: NUSRAT_AT_HOME,
      category: 'shopping',
      description: 'Daraz Bangladesh Order #{ref} - Nagad Payment',
      amount: [-1_400, -350],
    },
    {
      perMonth: [0, 1],
      skipBetween: NUSRAT_AT_HOME,
      category: 'healthcare',
      description: 'Lazz Pharma, Mirpur 10 - bKash Payment',
      amount: [-700, -150],
    },
    {
      perMonth: [0, 1],
      skipBetween: NUSRAT_AT_HOME,
      category: 'personal_care',
      description: 'Bella Beauty Parlour, Mirpur 1 - bKash Payment',
      amount: [-900, -300],
      roundTo: 50,
    },
  ],
}

export const TANVIR: Persona = {
  // Freelance developer in Dhanmondi. Paid in dollars through Payoneer by clients abroad,
  // spends in taka. Income swings from month to month; spending jumps with a PlayStation in
  // August and a trip to Cox's Bazar in September. Puts the same amount in a DPS monthly.
  // Eid-ul-Adha is on 27 May: he sends salami to his nieces and nephews on the 25th.
  id: 'tanvir',
  seed: 2202,
  currency: 'BDT',
  emergencySavings: 110_000,
  monthly: [
    {
      day: 1,
      category: 'rent',
      description: 'BEFTN Transfer to Md Anwar Hossain - Flat rent',
      amount: -28_000,
    },
    {
      day: 3,
      category: 'personal_care',
      description: 'Fitness Plus Gym Membership - Dhanmondi',
      amount: -2_500,
    },
    {
      day: 8,
      category: 'savings_deposit',
      description: 'DPS Instalment - BRAC Bank A/C xx5530',
      amount: -20_000,
    },
    {
      // Titas bills a single-burner connection a fixed amount each month.
      day: 10,
      category: 'utilities',
      description: 'bKash Pay Bill - Titas Gas, Dhanmondi',
      amount: -990,
    },
    {
      day: 12,
      jitterDays: 2,
      category: 'utilities',
      description: 'bKash Pay Bill - DPDC Electricity, Dhanmondi',
      amount: [-2_600, -1_500],
    },
    {
      day: 15,
      category: 'mobile_internet',
      description: 'bKash Pay Bill - Link3 Broadband',
      amount: -1_500,
    },
    {
      day: 18,
      category: 'entertainment',
      description: 'NETFLIX.COM - Card Payment',
      amount: -800,
    },
    {
      // A prepaid top-up, in an amount he picks.
      day: 20,
      jitterDays: 2,
      category: 'mobile_internet',
      description: 'Grameenphone Mobile Recharge 01712xxxxxx',
      amount: [-800, -500],
      roundTo: 100,
    },
    {
      // A client's monthly retainer, in dollars.
      day: 'last',
      category: 'freelance',
      currency: 'USD',
      description: 'Payoneer - Payment from Orbit Softworks Inc',
      amount: 560,
    },
    {
      day: 14,
      inMonths: [8],
      category: 'entertainment',
      description: 'Star Tech & Engineering - Sony PlayStation 5 Slim Console - Card Payment',
      amount: -77_500,
    },
    {
      day: 5,
      inMonths: [9],
      category: 'travel',
      description: 'US-Bangla Airlines Ltd - E-Ticket DAC-CXB-DAC - Card Payment',
      amount: -8_800,
    },
    {
      day: 18,
      inMonths: [9],
      category: 'travel',
      description: "Long Beach Hotel, Cox's Bazar - Card Payment",
      amount: -21_500,
    },
    {
      day: 25,
      inMonths: [5],
      category: 'gifts',
      description: 'bKash Send Money 01819xxxxxx - Eid salami',
      amount: -4_000,
    },
  ],
  scattered: [
    {
      perMonth: [1, 2],
      currency: 'USD',
      category: 'freelance',
      description: [
        'Payoneer - Payment from Upwork Global Inc',
        'Payoneer - Payment from Fiverr International Ltd',
        'Payoneer - Payment from Brightfield Labs LLC, Ref {ref}',
      ],
      amount: [250, 700],
      roundTo: 5,
    },
    {
      perMonth: [4, 6],
      category: 'groceries',
      description: 'Chaldal.com Order #{ref} - bKash Payment',
      amount: [-2_400, -700],
    },
    {
      perMonth: [2, 3],
      category: 'groceries',
      description: 'Shwapno Dhanmondi 27 - Card Payment',
      amount: [-1_600, -500],
    },
    {
      perMonth: [5, 9],
      category: 'eating_out',
      description: 'Foodpanda Order #FP{ref} - bKash Payment',
      amount: [-1_150, -350],
    },
    {
      perMonth: [1, 2],
      category: 'eating_out',
      description: ['Chillox Dhanmondi - Card Payment', 'Pizza Hut Dhanmondi 27 - Card Payment'],
      amount: [-2_800, -1_200],
    },
    {
      perMonth: [8, 12],
      category: 'transport',
      description: 'Pathao Ride #{ref} - bKash Payment',
      amount: [-450, -120],
    },
    {
      perMonth: [1, 2],
      category: 'shopping',
      description: 'Daraz Bangladesh Order #{ref} - bKash Payment',
      amount: [-3_200, -700],
    },
    {
      perMonth: [1, 2],
      category: 'cash_withdrawal',
      description: 'ATM Cash Withdrawal - BRAC Bank Dhanmondi',
      amount: [-8_000, -3_000],
      roundTo: 1_000,
    },
    {
      perMonth: [1, 2],
      category: 'personal_care',
      description: "Gentlemen's Barber Shop, Dhanmondi - bKash Payment",
      amount: [-700, -350],
      roundTo: 50,
    },
  ],
}

export const FARHANA: Persona = {
  // Office worker renting a flat in Mirpur. Earns 65,000 taka, but rent, a personal loan
  // and a credit card she never clears take most of it. Heavy Daraz shopping, paid by bKash.
  //
  // Her salary account and her bKash wallet are in the same file. Money moved between them
  // is not income or spending: it shows up on both sides and is not counted. She tops the
  // wallet up from the bank on the 1st and again mid-month, enough to cover what she pays
  // from it. She spends more than she earns, and the gap is covered by two loans from a
  // relative (which are not income) and by running down what she had.
  //
  // Eid-ul-Adha is on 27 May. Her employer pays a festival bonus of half the basic salary on
  // the 19th. She buys Eid clothes at Aarong, sends 15,000 to her mother for a qurbani share
  // and gives salami on the 25th and 26th. That is more than the bonus.
  id: 'farhana',
  seed: 3349,
  currency: 'BDT',
  emergencySavings: 5_000,
  monthly: [
    {
      day: 1,
      category: 'salary',
      description: 'Salary - Padma Logistics Ltd (BEFTN Credit)',
      amount: 65_000,
    },
    {
      day: 19,
      inMonths: [5],
      category: 'salary',
      description: 'Festival Bonus - Padma Logistics Ltd (BEFTN Credit)',
      amount: 20_000,
    },
    {
      day: 1,
      category: 'own_transfer',
      description: 'Add Money to bKash 01711xxxxxx - City Bank A/C',
      mirror: 'bKash Add Money from City Bank A/C xxxx4821',
      amount: -12_000,
    },
    {
      day: 14,
      jitterDays: 2,
      category: 'own_transfer',
      description: 'Add Money to bKash 01711xxxxxx - City Bank A/C',
      mirror: 'bKash Add Money from City Bank A/C xxxx4821',
      amount: [-8_000, -2_000],
      roundTo: 1_000,
    },
    {
      // Extra for the Eid shopping, the qurbani share and the salami.
      day: 20,
      inMonths: [5],
      category: 'own_transfer',
      description: 'Add Money to bKash 01711xxxxxx - City Bank A/C',
      mirror: 'bKash Add Money from City Bank A/C xxxx4821',
      amount: -25_000,
    },
    {
      day: 5,
      category: 'rent',
      description: 'BEFTN Transfer to Rokeya Begum - House rent',
      amount: -22_000,
    },
    {
      day: 7,
      category: 'loan_emi',
      description: 'Personal Loan EMI - City Bank A/C xxxx4821',
      amount: -12_000,
    },
    {
      // Her postpaid plan costs the same each month.
      day: 9,
      category: 'mobile_internet',
      description: 'bKash Pay Bill - Grameenphone Postpaid 01711xxxxxx',
      amount: -899,
    },
    {
      day: 11,
      category: 'mobile_internet',
      description: 'bKash Pay Bill - Link3 Broadband',
      amount: -1_100,
    },
    {
      // A prepaid meter: she tops it up in a round amount when it runs low.
      day: 14,
      jitterDays: 3,
      category: 'utilities',
      description: 'bKash Pay Bill - DESCO Prepaid Meter Recharge',
      amount: [-2_500, -1_500],
      roundTo: 500,
    },
    {
      day: 18,
      jitterDays: 2,
      category: 'card_payment',
      description: 'Credit Card Bill Payment - EBL Visa xx5512',
      amount: [-15_000, -11_000],
      roundTo: 500,
    },
    {
      day: 21,
      category: 'entertainment',
      description: 'NETFLIX.COM - City Bank Debit Card',
      amount: -800,
    },
    {
      day: 'last',
      category: 'utilities',
      description: 'bKash Pay Bill - Titas Gas, Mirpur 12',
      amount: -990,
    },
    {
      // Two loans from a cousin, paid into bKash. Borrowed money is not income.
      day: 9,
      inMonths: [7],
      category: 'loan_received',
      description: 'bKash Received 01912xxxxxx - Loan from Shila Apa',
      amount: 15_000,
    },
    {
      day: 6,
      inMonths: [10],
      category: 'loan_received',
      description: 'bKash Received 01912xxxxxx - Loan from Shila Apa',
      amount: 10_000,
    },
    {
      day: 21,
      inMonths: [5],
      category: 'family_support_out',
      description: 'bKash Send Money to Ammu 01715xxxxxx - Qurbani share',
      amount: -15_000,
    },
    {
      day: 22,
      inMonths: [5],
      category: 'shopping',
      description: 'bKash Payment - AARONG, Mirpur',
      amount: [-5_500, -3_500],
      roundTo: 100,
    },
    {
      day: 25,
      inMonths: [5],
      category: 'gifts',
      description: 'bKash Send Money 01618xxxxxx - Eid salami',
      amount: -1_500,
    },
    {
      day: 26,
      inMonths: [5],
      category: 'gifts',
      description: 'bKash Send Money 01819xxxxxx - Eid salami',
      amount: -2_000,
    },
  ],
  scattered: [
    {
      perMonth: [3, 5],
      category: 'shopping',
      description: 'bKash Payment - Daraz Bangladesh Order #{ref}',
      amount: [-2_300, -600],
    },
    {
      perMonth: [2, 3],
      category: 'groceries',
      description: 'Chaldal.com Order #{ref} - bKash Payment',
      amount: [-2_000, -900],
    },
    {
      perMonth: [1, 2],
      category: 'groceries',
      description: 'bKash Payment - Shwapno Mirpur 12',
      amount: [-1_300, -500],
    },
    {
      perMonth: [3, 4],
      category: 'eating_out',
      description: 'Foodpanda Order #FP{ref} - bKash Payment',
      amount: [-850, -300],
    },
    {
      perMonth: [5, 8],
      category: 'transport',
      description: 'Pathao Ride #{ref} - bKash Payment',
      amount: [-400, -150],
    },
    {
      perMonth: [1, 1],
      category: 'personal_care',
      description: 'Yellow Beauty Parlour, Mirpur 10 - bKash Payment',
      amount: [-1_800, -900],
      roundTo: 100,
    },
    {
      // The 9.9 sale.
      perMonth: [1, 1],
      inMonths: [9],
      category: 'shopping',
      description: 'bKash Payment - Daraz 9.9 Sale Order #{ref}',
      amount: [-6_500, -5_000],
    },
  ],
}

export const ARIF: Persona = {
  // Bangladeshi MSc student in London. Part-time wages from a catering job and family
  // support each month. Pays for a room in a shared house in Ilford, with a fixed share of
  // the bills to the housemate who holds them. Eats at Tesco and spends nearly all of it: a
  // lot of takeaway and shopping, a new laptop and, in August, a flight home that the family
  // pays for. On Eid-ul-Adha (27 May) he has dinner out with friends.
  id: 'arif',
  seed: 4070,
  currency: 'GBP',
  emergencySavings: 320,
  monthly: [
    {
      day: 1,
      category: 'rent',
      description: 'STANDING ORDER TO R PATEL - ROOM RENT',
      amount: -780,
    },
    {
      // His share of the energy, water and broadband, paid to the housemate whose name is on them.
      day: 1,
      category: 'utilities',
      description: 'STANDING ORDER TO H ALI - UTILITIES SHARE',
      amount: -70,
    },
    {
      // Sent by his family as a round sum in pounds, through their bank.
      day: 3,
      category: 'family_support_in',
      description: 'INTERNATIONAL PAYMENT FROM M RAHMAN - FAMILY SUPPORT',
      amount: 800,
    },
    {
      day: 5,
      category: 'entertainment',
      description: 'SPOTIFY P{hex} STOCKHOLM',
      amount: -5.99,
    },
    {
      // A giffgaff goodybag, bought each month.
      day: 11,
      category: 'mobile_internet',
      description: 'CARD PAYMENT TO GIFFGAFF.COM',
      amount: -10,
    },
    {
      day: 22,
      category: 'entertainment',
      description: 'NETFLIX.COM',
      amount: -12.99,
    },
    {
      day: 25,
      category: 'personal_care',
      description: 'CARD PAYMENT TO PURE GYM LTD LONDON',
      amount: -22.99,
    },
    {
      day: 28,
      jitterDays: 1,
      category: 'salary',
      description: 'BACS CREDIT HARBOUR CATERING LTD WAGES',
      amount: [740, 900],
    },
    {
      day: 'last',
      category: 'savings_deposit',
      description: 'STANDING ORDER TO MARCUS SAVINGS',
      amount: -25,
    },
    {
      day: 27,
      inMonths: [5],
      category: 'eating_out',
      description: 'CARD PAYMENT TO SHAHI BIRYANI HOUSE ILFORD',
      amount: [-30, -18],
      roundTo: 0.5,
    },
    {
      // Family pays for a flight home in August.
      day: 2,
      inMonths: [8],
      category: 'family_support_in',
      description: 'INTERNATIONAL PAYMENT FROM M RAHMAN - FAMILY SUPPORT TICKET',
      amount: 650,
    },
    {
      day: 4,
      inMonths: [8],
      category: 'travel',
      description: 'CARD PAYMENT TO BIMAN BANGLADESH AIRLINES LONDON',
      amount: [-660, -620],
    },
    {
      day: 9,
      inMonths: [9],
      category: 'shopping',
      description: 'CARD PAYMENT TO CURRYS 0392 LONDON',
      amount: -429,
    },
  ],
  scattered: [
    {
      perMonth: [6, 9],
      category: 'groceries',
      description: ['CARD PAYMENT TO TESCO STORES 2811', 'CARD PAYMENT TO TESCO EXPRESS 5474'],
      amount: [-42, -8],
    },
    {
      perMonth: [1, 2],
      category: 'groceries',
      description: 'CARD PAYMENT TO LIDL GB LONDON',
      amount: [-25, -10],
    },
    {
      perMonth: [5, 8],
      category: 'transport',
      description: 'CARD PAYMENT TO TFL TRAVEL CH, TFL.GOV.UK/CP',
      amount: [-24, -8],
      roundTo: 0.05,
    },
    {
      perMonth: [4, 6],
      category: 'eating_out',
      description: ['CARD PAYMENT TO PRET A MANGER 1403', 'CARD PAYMENT TO GREGGS PLC 0921'],
      amount: [-9, -3.5],
    },
    {
      perMonth: [5, 7],
      category: 'eating_out',
      description: 'DELIVEROO PLC LONDON',
      amount: [-30, -14],
    },
    {
      perMonth: [1, 2],
      category: 'eating_out',
      description: 'CARD PAYMENT TO NANDOS 0316 ILFORD',
      amount: [-24, -14],
    },
    {
      perMonth: [1, 2],
      category: 'shopping',
      description: 'CARD PAYMENT TO PRIMARK 0414',
      amount: [-55, -12],
      roundTo: 0.5,
    },
    {
      perMonth: [0, 1],
      category: 'shopping',
      description: 'AMAZON.CO.UK*{code} AMZNMKTPLACE',
      amount: [-35, -8],
    },
    {
      perMonth: [1, 2],
      category: 'entertainment',
      description: 'CARD PAYMENT TO CINEWORLD ILFORD',
      amount: [-14, -9],
      roundTo: 0.5,
    },
    {
      perMonth: [1, 1],
      category: 'personal_care',
      description: 'CARD PAYMENT TO BARBER SHOP ILFORD',
      amount: [-22, -15],
      roundTo: 1,
    },
    {
      perMonth: [0, 1],
      category: 'healthcare',
      description: 'CARD PAYMENT TO BOOTS 1130',
      amount: [-14, -4],
    },
    {
      perMonth: [1, 1],
      inMonths: [10],
      category: 'shopping',
      description: 'CARD PAYMENT TO UNIQLO OXFORD STREET',
      amount: [-85, -70],
      roundTo: 0.1,
    },
  ],
}

export const RAHIM: Persona = {
  // Construction worker in Singapore, living in an employer-provided dormitory, so
  // there is no rent. Earns 1,500 dollars and sends about 700 home every month, in two
  // transfers through Instarem, whose fee is added to what he pays. He cooks in the dorm,
  // spends the same way every month, and puts what is left into savings.
  //
  // Before Eid-ul-Adha (27 May, a public holiday here) his family needs the money earlier,
  // so the second transfer goes on the 21st and not mid-month. On the day he eats a biryani
  // in Little India.
  id: 'rahim',
  seed: 5505,
  currency: 'SGD',
  emergencySavings: 2_600,
  monthly: [
    {
      day: 1,
      category: 'family_support_out',
      description: 'FAST PAYMENT TO INSTAREM PTE LTD REF IN{ref}',
      amount: [-520, -480],
      roundTo: 10,
      feeIncluded: REMITTANCE_FEE_RATE,
    },
    {
      day: 10,
      jitterDays: 3,
      category: 'mobile_internet',
      description: 'NETS SINGTEL PREPAID TOP UP 9123',
      amount: -10,
    },
    {
      day: 15,
      jitterDays: 2,
      inMonths: [6, 7, 8, 9, 10],
      category: 'family_support_out',
      description: 'FAST PAYMENT TO INSTAREM PTE LTD REF IN{ref}',
      amount: [-220, -180],
      roundTo: 10,
      feeIncluded: REMITTANCE_FEE_RATE,
    },
    {
      day: 28,
      category: 'salary',
      description: 'INWARD GIRO SALARY - LIM & SONS BUILDERS PTE LTD',
      amount: 1_500,
    },
    {
      day: 'last',
      category: 'savings_deposit',
      description: 'FAST TRANSFER TO POSB SAVINGS ACCOUNT',
      amount: [-200, -140],
      roundTo: 10,
    },
    {
      day: 12,
      inMonths: [9],
      category: 'shopping',
      description: 'NETS CHALLENGER ELECTRONICS FUNAN',
      amount: -189,
    },
    {
      day: 21,
      inMonths: [5],
      category: 'family_support_out',
      description: 'FAST PAYMENT TO INSTAREM PTE LTD REF IN{ref}',
      amount: [-220, -180],
      roundTo: 10,
      feeIncluded: REMITTANCE_FEE_RATE,
    },
    {
      day: 27,
      inMonths: [5],
      category: 'eating_out',
      description: 'NETS BIRYANI RESTAURANT LITTLE INDIA',
      amount: -14,
    },
  ],
  scattered: [
    {
      perMonth: [6, 8],
      category: 'groceries',
      description: [
        'NETS FAIRPRICE 8102',
        'NETS SHENG SIONG 4417',
        'NETS FAIRPRICE XPRESS 2217',
      ],
      amount: [-62, -18],
    },
    {
      perMonth: [16, 22],
      category: 'eating_out',
      description: ['NETS KOPITIAM FOODCOURT', 'NETS HAWKER STALL 0217', 'NETS HAWKER STALL 0344'],
      amount: [-6.5, -3.5],
      roundTo: 0.1,
    },
    {
      perMonth: [1, 2],
      category: 'eating_out',
      description: 'NETS BIRYANI RESTAURANT LITTLE INDIA',
      amount: [-15, -8],
      roundTo: 0.5,
    },
    {
      perMonth: [3, 5],
      category: 'transport',
      description: 'SIMPLYGO MRT BUS',
      amount: [-5.5, -1.5],
    },
    {
      perMonth: [1, 2],
      category: 'cash_withdrawal',
      description: 'ATM CASH WITHDRAWAL POSB 2231',
      amount: [-100, -50],
      roundTo: 10,
    },
    {
      perMonth: [1, 2],
      category: 'shopping',
      description: 'SHOPEE SINGAPORE 7710',
      amount: [-40, -12],
    },
    {
      perMonth: [0, 1],
      category: 'personal_care',
      description: 'NETS BARBER SHOP LITTLE INDIA',
      amount: [-10, -8],
      roundTo: 1,
    },
    {
      perMonth: [0, 1],
      category: 'healthcare',
      description: 'NETS GUARDIAN PHARMACY',
      amount: [-25, -5],
    },
  ],
}
