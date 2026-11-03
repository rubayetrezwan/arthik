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

export const NUSRAT: Persona = {
  // University student sharing a mess in Mirpur. About 23,000 taka comes in: 15,000
  // family allowance and 8,000 from two tuition students.
  id: 'nusrat',
  seed: 1101,
  currency: 'BDT',
  emergencySavings: 15_000,
  monthly: [
    {
      day: 1,
      category: 'family_support_in',
      description: 'Family allowance from Abbu - bKash Received 01711xxxxxx',
      amount: 15_000,
    },
    {
      day: 2,
      category: 'rent',
      description: 'bKash Payment - Mess seat rent, Mirpur 10',
      amount: -5_500,
    },
    {
      day: 6,
      category: 'savings_deposit',
      description: 'DPS Instalment - Dutch-Bangla Bank (Student DPS)',
      amount: -500,
    },
    {
      day: 10,
      jitterDays: 2,
      category: 'side_income',
      description: 'Nagad Received 01811xxxxxx - Tuition fee (Class 9 Math)',
      amount: 4_500,
    },
    {
      day: 12,
      jitterDays: 3,
      category: 'mobile_internet',
      description: 'Robi Internet Pack 30GB - Mobile Recharge 01812xxxxxx',
      amount: [-399, -299],
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
      description: 'Nagad Received 01911xxxxxx - Tuition fee (Class 7)',
      amount: 3_500,
    },
    {
      day: 20,
      inMonths: [7, 10],
      category: 'education',
      description: 'University semester exam fee - bKash Payment',
      amount: [-1_800, -1_200],
    },
    {
      day: 12,
      inMonths: [9],
      category: 'healthcare',
      description: 'Dental clinic, Mirpur 10 - bKash Payment',
      amount: [-3_600, -2_800],
    },
  ],
  scattered: [
    {
      perMonth: [10, 13],
      category: 'eating_out',
      description: 'Foodpanda Order #FP{ref} - bKash Payment',
      amount: [-600, -200],
    },
    {
      perMonth: [1, 2],
      category: 'groceries',
      description: 'Chaldal.com Order #{ref} - bKash Payment',
      amount: [-1_800, -600],
    },
    {
      perMonth: [2, 3],
      category: 'groceries',
      description: 'bKash Payment - Shwapno Mirpur 10',
      amount: [-900, -250],
    },
    {
      perMonth: [4, 7],
      category: 'transport',
      description: 'Pathao Ride #{ref} - bKash Payment',
      amount: [-260, -90],
    },
    {
      perMonth: [2, 3],
      category: 'transport',
      description: 'MRT Rapid Pass Recharge - Mirpur 10 Station',
      amount: [-500, -300],
      roundTo: 100,
    },
    {
      perMonth: [2, 3],
      category: 'cash_withdrawal',
      description: 'bKash Cash Out - Agent 01712xxxxxx',
      amount: [-3_000, -1_000],
      roundTo: 500,
      charge: { description: 'bKash Cash Out Charge', rate: BKASH_CASH_OUT_RATE },
    },
    {
      perMonth: [0, 1],
      category: 'shopping',
      description: 'Daraz Bangladesh Order #{ref} - bKash Payment',
      amount: [-1_400, -350],
    },
    {
      perMonth: [0, 1],
      category: 'healthcare',
      description: 'Lazz Pharma, Mirpur 10 - bKash Payment',
      amount: [-700, -150],
    },
    {
      perMonth: [0, 1],
      category: 'personal_care',
      description: 'Bella Beauty Parlour, Mirpur 1 - bKash Payment',
      amount: [-900, -300],
    },
    {
      // Eid-ul-Adha is at the end of May: a bus home to Barishal and new clothes.
      perMonth: [1, 1],
      inMonths: [5],
      category: 'transport',
      description: 'Bus ticket Dhaka-Barishal - bKash Payment',
      amount: [-1_000, -800],
    },
    {
      perMonth: [1, 1],
      inMonths: [5],
      category: 'shopping',
      description: 'Aarong Mirpur (Eid) - bKash Payment',
      amount: [-2_800, -1_800],
    },
  ],
}

export const TANVIR: Persona = {
  // Freelance developer in Dhanmondi. Paid in dollars through Payoneer by clients abroad,
  // spends in taka. Income swings from month to month; spending jumps with a laptop in
  // August and a trip to Cox's Bazar in September. Puts the same amount in a DPS monthly.
  id: 'tanvir',
  seed: 2202,
  currency: 'BDT',
  emergencySavings: 110_000,
  monthly: [
    {
      day: 1,
      category: 'rent',
      description: 'BEFTN Transfer - Flat rent, Road 27 Dhanmondi',
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
      day: 10,
      category: 'utilities',
      description: 'Titas Gas Bill - Dhanmondi (bKash Pay Bill)',
      amount: -990,
    },
    {
      day: 12,
      jitterDays: 2,
      category: 'utilities',
      description: 'DPDC Electricity Bill (bKash Pay Bill)',
      amount: [-2_600, -1_500],
    },
    {
      day: 15,
      category: 'mobile_internet',
      description: 'Link3 Broadband Bill (bKash Pay Bill)',
      amount: -1_500,
    },
    {
      day: 18,
      category: 'entertainment',
      description: 'Netflix Subscription',
      amount: -800,
    },
    {
      day: 20,
      jitterDays: 2,
      category: 'mobile_internet',
      description: 'Grameenphone Mobile Recharge 01712xxxxxx',
      amount: [-799, -499],
    },
    {
      day: 'last',
      category: 'freelance',
      currency: 'USD',
      description: 'Payoneer Payment - Orbit Softworks Inc. (monthly retainer)',
      amount: 560,
    },
    {
      day: 14,
      inMonths: [8],
      category: 'shopping',
      description: 'StarTech Computer Ltd - Laptop (Card Payment)',
      amount: -78_000,
    },
    {
      day: 5,
      inMonths: [9],
      category: 'travel',
      description: "US-Bangla Airlines - Dhaka to Cox's Bazar",
      amount: -8_800,
    },
    {
      day: 18,
      inMonths: [9],
      category: 'travel',
      description: "Hotel booking, Laboni Beach Cox's Bazar - 3 nights",
      amount: -21_500,
    },
  ],
  scattered: [
    {
      perMonth: [1, 2],
      currency: 'USD',
      category: 'freelance',
      description: [
        'Payoneer Payment - Upwork Escrow Release (Contract {ref})',
        'Payoneer Payment - Fiverr Order #FO{ref}',
        'Payoneer Payment - Brightfield Labs Invoice {ref}',
      ],
      amount: [250, 700],
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
    },
  ],
}

export const FARHANA: Persona = {
  // Office worker renting a flat in Mirpur. Earns 65,000 taka, but rent, a personal loan
  // and a credit card she never clears take most of it. Heavy Daraz shopping, paid by bKash.
  id: 'farhana',
  seed: 3303,
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
      // Her bank account and her bKash wallet are in the same file. Money moved between
      // them is not income or spending, so it shows up on both sides and is not counted.
      day: 2,
      category: 'own_transfer',
      description: 'Add Money to bKash 01711xxxxxx - City Bank A/C',
      amount: -20_000,
    },
    {
      day: 2,
      category: 'own_transfer',
      description: 'bKash Add Money from City Bank A/C xxxx4821',
      amount: 20_000,
    },
    {
      day: 5,
      category: 'rent',
      description: 'BEFTN Transfer - House rent, Flat 4C Mirpur 12',
      amount: -22_000,
    },
    {
      day: 7,
      category: 'loan_emi',
      description: 'Personal Loan EMI - City Bank A/C xxxx4821',
      amount: -12_000,
    },
    {
      day: 9,
      category: 'mobile_internet',
      description: 'Grameenphone Postpaid Bill 01711xxxxxx (bKash Pay Bill)',
      amount: [-999, -799],
    },
    {
      day: 11,
      category: 'mobile_internet',
      description: 'Link3 Broadband Bill (bKash Pay Bill)',
      amount: -1_100,
    },
    {
      day: 14,
      jitterDays: 3,
      category: 'utilities',
      description: 'DESCO Prepaid Meter Recharge (bKash Pay Bill)',
      amount: [-2_300, -1_400],
    },
    {
      day: 18,
      jitterDays: 2,
      category: 'card_payment',
      description: 'Credit Card Bill Payment - EBL Visa xx5512',
      amount: [-15_000, -11_000],
      roundTo: 50,
    },
    {
      day: 21,
      category: 'entertainment',
      description: 'Netflix Subscription',
      amount: -800,
    },
    {
      day: 'last',
      category: 'utilities',
      description: 'Titas Gas Bill - Mirpur 12 (bKash Pay Bill)',
      amount: -990,
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
    },
    {
      // The 9.9 sale.
      perMonth: [1, 1],
      inMonths: [9],
      category: 'shopping',
      description: 'bKash Payment - Daraz 9.9 Sale Order #{ref}',
      amount: [-6_500, -5_000],
    },
    {
      // Eid-ul-Adha is at the end of May.
      perMonth: [1, 1],
      inMonths: [5],
      category: 'shopping',
      description: 'bKash Payment - Aarong Eid Collection, Mirpur',
      amount: [-4_500, -2_500],
    },
    {
      perMonth: [1, 1],
      inMonths: [5],
      category: 'gifts',
      description: 'bKash Send Money 01715xxxxxx - Eid salami',
      amount: [-2_000, -1_500],
    },
  ],
}

export const ARIF: Persona = {
  // Bangladeshi MSc student in London. Part-time wages from a catering job and family
  // support each month. Pays for a room, eats at Tesco, and spends nearly all of it:
  // a lot of takeaway and shopping, a new laptop and, in August, a flight home that
  // the family pays for.
  id: 'arif',
  seed: 4404,
  currency: 'GBP',
  emergencySavings: 320,
  monthly: [
    {
      day: 1,
      category: 'rent',
      description: 'STANDING ORDER - ROOM RENT - 14 EASTBROOK RD',
      amount: -780,
    },
    {
      day: 3,
      category: 'family_support_in',
      description: 'FASTER PAYMENT IN - FAMILY SUPPORT - M RAHMAN',
      amount: [800, 840],
    },
    {
      day: 5,
      category: 'entertainment',
      description: 'SPOTIFY P1A2B3 STOCKHOLM',
      amount: -5.99,
    },
    {
      day: 8,
      category: 'mobile_internet',
      description: 'DIRECT DEBIT VIRGIN MEDIA',
      amount: -24,
    },
    {
      day: 11,
      category: 'mobile_internet',
      description: 'CARD PAYMENT TO GIFFGAFF TOP UP',
      amount: -10,
    },
    {
      day: 16,
      category: 'utilities',
      description: 'DIRECT DEBIT OCTOPUS ENERGY',
      amount: [-62, -48],
    },
    {
      day: 20,
      category: 'utilities',
      description: 'DIRECT DEBIT THAMES WATER',
      amount: [-22, -18],
    },
    {
      day: 22,
      category: 'entertainment',
      description: 'NETFLIX.COM',
      amount: -10.99,
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
      // Family pays for a flight home in August.
      day: 2,
      inMonths: [8],
      category: 'family_support_in',
      description: 'FASTER PAYMENT IN - FAMILY SUPPORT FOR TICKET - M RAHMAN',
      amount: [645, 660],
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
      amount: -430,
    },
  ],
  scattered: [
    {
      perMonth: [6, 9],
      category: 'groceries',
      description: [
        'CARD PAYMENT TO TESCO STORES 2811',
        'CARD PAYMENT TO TESCO EXPRESS 5474',
      ],
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
      perMonth: [1, 3],
      category: 'shopping',
      description: ['CARD PAYMENT TO PRIMARK 0414', 'AMAZON.CO.UK*RT4KD2 AMZNMKTPLACE'],
      amount: [-55, -12],
    },
    {
      perMonth: [1, 2],
      category: 'entertainment',
      description: 'CARD PAYMENT TO ODEON LEICESTER SQ',
      amount: [-16, -10],
    },
    {
      perMonth: [1, 1],
      category: 'personal_care',
      description: 'CARD PAYMENT TO BARBER SHOP ILFORD',
      amount: [-22, -15],
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
    },
  ],
}

export const RAHIM: Persona = {
  // Construction worker in Singapore, living in an employer-provided dormitory, so
  // there is no rent. Earns 1,500 dollars and sends about 700 home every month. He cooks
  // in the dorm, spends the same way every month, and puts what is left into savings.
  id: 'rahim',
  seed: 5505,
  currency: 'SGD',
  emergencySavings: 2_600,
  monthly: [
    {
      day: 1,
      category: 'family_support_out',
      description: 'FAST PAYMENT TO INSTAREM - REMITTANCE BANGLADESH',
      amount: [-520, -480],
      roundTo: 10,
      charge: { description: 'REMITTANCE FEE - INSTAREM', rate: REMITTANCE_FEE_RATE },
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
      category: 'family_support_out',
      description: 'FAST PAYMENT TO INSTAREM - REMITTANCE BANGLADESH',
      amount: [-220, -180],
      roundTo: 10,
      charge: { description: 'REMITTANCE FEE - INSTAREM', rate: REMITTANCE_FEE_RATE },
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
    },
    {
      perMonth: [1, 2],
      category: 'eating_out',
      description: 'NETS BIRYANI RESTAURANT LITTLE INDIA',
      amount: [-15, -8],
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
    },
    {
      perMonth: [0, 1],
      category: 'healthcare',
      description: 'NETS GUARDIAN PHARMACY',
      amount: [-25, -5],
    },
  ],
}
