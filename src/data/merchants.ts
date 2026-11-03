// Keyword and merchant rules for the categoriser (spec 5.3 and 8). Pure data: no React, no DOM.
//
// How matching works (see categorize.ts):
// - The description is tidied first: apostrophes are dropped, hyphens, dashes and
//   underscores become spaces, runs of whitespace become one space. So "cash-out",
//   "Cash_Out" and "cash out" are the same text, "Sainsbury's" is "sainsburys", and
//   a pattern can assume single spaces.
// - Patterns are case-insensitive and stateless (flag `i` only).
// - The FIRST rule whose pattern matches and whose direction fits the sign of the
//   amount wins. A rule never assigns a category whose direction contradicts its own
//   (a test checks this for every rule).
// - Latin keywords use `\b`. Bengali keywords never do: `\b` only understands ASCII
//   word characters, so it can never match next to a Bengali letter.
// - Bengali is written in NFC, the form categorize.ts converts the description to.
//   That splits ড় into ড + nukta (U+09A1 U+09BC).
// - Merchant and spending keywords apply to money out only. A bare merchant name on
//   money in is not a refund, so it stays unrecognised income for the visitor to check.
//
// Order matters. The sections below are listed in the order they run, and each
// section's comment says what it has to beat:
//   refunds, interest        before the other money-in rules ("Tuition fee refund" is
//                            not tutoring income, "DPS interest" is not a DPS maturity)
//   fees on moving money     before cash-out, transfers and debt ("cash-out charge" is
//                            a fee, not cash; "credit card annual fee" is not a card bill)
//   own transfers, cash in   before income ("Add Money from bank" is not income)
//   income                   before savings withdrawals ("salary" paid into savings)
//   debt, savings            before merchants ("Tesco Bank" card bill, "Daraz PayLater")
//   merchants                mobile before groceries, then groceries, eating out and
//                            transport in that order. A sub-brand sits in an earlier
//                            section than its parent brand (Pathao Food before Pathao).
//   other fees               last, so "Foodpanda delivery fee" stays eating out
// Merchant rules cover money out only, so they cannot collide with the money-in rules.

import type { Direction } from '../domain/categories'
import type { CategoryId } from '../domain/types'

export interface Rule {
  pattern: RegExp
  category: CategoryId
  /** Which sign of amount the rule applies to: 'in' is money in, 'out' money out. */
  direction: Direction
}

function rulesFor(direction: Direction, category: CategoryId, patterns: RegExp[]): Rule[] {
  return patterns.map((pattern) => ({ pattern, category, direction }))
}

/** Money in only. */
const inflow = (category: CategoryId, ...patterns: RegExp[]) => rulesFor('in', category, patterns)
/** Money out only. */
const outflow = (category: CategoryId, ...patterns: RegExp[]) => rulesFor('out', category, patterns)
/** Either way. Only a category that allows both directions may use this. */
const either = (category: CategoryId, ...patterns: RegExp[]) => rulesFor('any', category, patterns)

// ---------------------------------------------------------------------------
// Refunds and reversals (money in). First, so a refund that also names an income
// or transfer keyword ("Tuition fee refund", "Upwork refund") is not read as income.
// Merchant names cannot clash with it: merchant rules only look at money out.
// ---------------------------------------------------------------------------
const refunds = inflow('refund', /\b(?:refund(?:ed|s)?|reversal|reversed|chargeback|cash ?back)\b/i)

// Interest and dividends are real income that we do recognise, so they are not flagged.
// Before the savings rules: "Sanchayapatra profit" is income, "Sanchayapatra" alone is a
// maturity.
const interest = inflow('other_income', /\b(?:interest|dividends?|profit)\b/i)

// ---------------------------------------------------------------------------
// Fees on moving money (money out). Before cash-out, own transfers and the debt
// rules, which would otherwise take "bKash cash-out charge" or "credit card annual fee".
// Needs a fee word right after the thing it is charged on, so "Transfer to school fee"
// is left for the education rule.
// ---------------------------------------------------------------------------
const feesOnMovingMoney = outflow(
  'fees',
  /\b(?:cash ?out|cash ?in|atm|withdrawals?|add ?money|send ?money|transfers?|remittance|transaction|card|annual|renewal|late|overdraft|processing|maintenance)(?: (?:service|handling|processing|payment|usage|bank|banking|sms|vat))? (?:fees?|charges?)\b/i,
  // Taxes and bank charges that name themselves.
  /\b(?:vat|excise duty|stamp duty|bank charges?|account maintenance|sms (?:banking )?(?:alerts?|fees?|charges?))\b/i,
)

// ---------------------------------------------------------------------------
// Moving the visitor's own money (not counted). Before income: "Add Money from bank"
// must not look like salary, and "Cash In" is not income.
// ---------------------------------------------------------------------------
const ownTransfers = either(
  'own_transfer',
  // Wallet top-up from a bank account (bKash, Nagad, Rocket and Upay all call it this).
  /\badd ?money\b/i,
  /\b(?:bkash|nagad|rocket|upay|wallet) to (?:my )?bank\b/i,
  /\bbank to (?:my )?(?:bkash|nagad|rocket|upay|wallet)\b/i,
  /\b(?:own|self|between my|my other) (?:accounts?|transfer)\b/i,
)

const cashIn = inflow(
  'cash_deposit',
  // Agent cash-in (bKash, Nagad, Rocket) and cash paid in at a bank or machine.
  /\bcash ?in\b/i,
  /\b(?:cash|cdm|atm) deposits?\b/i,
)

// ---------------------------------------------------------------------------
// Cash out (money out). Counts as spending because cash is assumed spent.
// Its charge was already taken by the fee rules above.
// ---------------------------------------------------------------------------
const cashOut = outflow(
  'cash_withdrawal',
  // bKash, Nagad, Rocket, Upay.
  /\bcash ?out\b/i,
  /\bcash (?:withdrawals?|withdrawn|advance|machine|point)\b|\bcashpoint\b/i,
  /\batm\b/i,
)

// ---------------------------------------------------------------------------
// Money to and from family and abroad. Sending money home is an essential, not a want.
// Wise, like the other transfer services, is also used between a person's own
// accounts; the visitor can change those in the review table.
// ---------------------------------------------------------------------------
const TRANSFER_SERVICES =
  /\b(?:remittances?|remit|western union|moneygram|remitly|worldremit|xoom|sendwave|instarem|singx|(?:transfer)?wise)\b/i

const FAMILY_MONEY = /\b(?:family (?:support|allowance|money|expenses)|pocket money)\b/i

const familyAndRemittances = [
  ...inflow('remittance_in', TRANSFER_SERVICES),
  ...inflow(
    'family_support_in',
    FAMILY_MONEY,
    /\bfrom (?:mom|mum|mother|dad|father|abbu|ammu|amma|abba|parents)\b/i,
  ),
  ...outflow(
    'family_support_out',
    TRANSFER_SERVICES,
    FAMILY_MONEY,
    /\bto (?:mom|mum|mother|dad|father|abbu|ammu|amma|abba|parents)\b/i,
  ),
]

// ---------------------------------------------------------------------------
// Income (money in).
// ---------------------------------------------------------------------------
const income = [
  // বেতন = salary.
  ...inflow('salary', /\b(?:salary|salaries|payroll|wages?|bonus)\b|বেতন/i),
  // Marketplaces and payout services freelancers are paid through.
  ...inflow('freelance', /\b(?:freelanc\w*|payoneer|upwork|fiverr|toptal|peopleperhour|99designs)\b/i),
  // Tutoring is the usual side income. টিউশন = tuition (as an outflow it is education, below).
  ...inflow('side_income', /\b(?:tuition|tutoring|tutor)\b|টিউশন/i),
]

// ---------------------------------------------------------------------------
// Debt payments (money out). Before merchants: "Tesco Bank" is a card bill, and a
// "PayLater" or "EMI" at a shop is still debt.
// ---------------------------------------------------------------------------
const loans = outflow(
  'loan_emi',
  /\bemi\b/i,
  // "Loan to Rafiq" is lending, not repaying, so it is left alone.
  /\b(?:loan|mortgage|hire purchase)\b(?! to\b)/i,
)

const cardBills = outflow(
  'card_payment',
  /\bcredit ?card\b/i,
  // Not "card payment": UK banks label every debit-card purchase "card payment to <shop>".
  /\bcard (?:bill|repayment|dues?|settlement)\b/i,
  /\b(?:barclaycard|amex|american express|mbna|capital one|tesco bank)\b/i,
)

const buyNowPayLater = outflow(
  'bnpl',
  // No leading \b: Shopee's product is written "SPayLater".
  /pay ?later\b|\bbuy now pay later\b|\bbnpl\b/i,
  /\b(?:klarna|afterpay|clearpay|laybuy|zilch|atome|hoolah)\b/i,
)

// ---------------------------------------------------------------------------
// Savings and investments (money out), and money coming back from them.
// ---------------------------------------------------------------------------
const SAVINGS_PRODUCTS = /\b(?:dps|fdr|fd|(?:fixed|recurring|term) deposit)\b/i

const savingsAndInvestments = [
  // DPS = deposit pension scheme, FDR = fixed deposit receipt.
  ...outflow('savings_deposit', SAVINGS_PRODUCTS, /\bsavings\b/i, /\bpension\b/i),
  ...outflow(
    'investments',
    // Sanchayapatra (national savings certificate), however it is spelled.
    /\bsanchay ?a? ?patr[ao]\b|\bsavings certificates?\b/i,
    /\b(?:mutual fund|unit fund|premium bonds?|treasury bonds?|ipo|etf)\b/i,
    /\b(?:trading 212|freetrade|hargreaves lansdown|vanguard|moomoo|tiger brokers|syfe|stashaway|endowus)\b/i,
  ),
]

// ---------------------------------------------------------------------------
// Money in that is not income (not counted). After income and interest, so a salary
// paid into a savings account or interest on a DPS is still recognised as such.
// ---------------------------------------------------------------------------
const notIncome = [
  ...inflow(
    'savings_withdrawal',
    SAVINGS_PRODUCTS,
    /\bsavings\b/i,
    /\bsanchay ?a? ?patr[ao]\b/i,
    /\b(?:maturity|matured|encashment|encashed)\b/i,
  ),
  // A disbursement, or a friend lending. A repayment received is not income either.
  ...inflow('loan_received', /\bloan\b/i),
]

// ---------------------------------------------------------------------------
// Merchants and keywords by category (money out only).
// ---------------------------------------------------------------------------

// Utilities.
const utilities = outflow(
  'utilities',
  // Bangladesh electricity. বিদ্যুৎ (and the common বিদ্যুত spelling) = electricity.
  /\b(?:desco|dpdc|nesco|wzpdcl|breb|palli bidyut|prepaid meter|electricity|electric bill|power bill)\b|বিদ্যুৎ|বিদ্যুত/i,
  // Bangladesh gas (Titas, Karnaphuli, Bakhrabad, ...) and cooking gas.
  /\b(?:titas|karnaphuli|bakhrabad|jalalabad gas|pashchimanchal|sundarban gas|gas bill|lpg|gas cylinder|cylinder)\b/i,
  // Water: WASA is the water authority (DWASA in Dhaka, CWASA in Chattogram).
  /\b(?:d?c?wasa|water bill|sewerage)\b/i,
  // UK.
  /\b(?:british gas|edf|e\.?on|octopus energy|ovo|scottish power|sse|npower|utility warehouse)\b/i,
  /\b(?:thames|severn trent|anglian|yorkshire|southern|welsh|northumbrian) water\b|\bunited utilities\b|\bdwr cymru\b/i,
  // Singapore.
  /\b(?:sp (?:group|services)|city energy|geneco|senoko|tuas power|keppel electric|sembcorp power|union power)\b/i,
  /\butilit(?:y|ies)\b/i,
)

// Mobile and internet. Before groceries so "Tesco Mobile" is not a supermarket.
const mobileAndInternet = outflow(
  'mobile_internet',
  // Bangladesh operators and ISPs.
  /\b(?:grameen ?phone|robi|airtel|banglalink|teletalk|citycell|skitto|link3|carnival internet|amber ?it|dot internet|bdcom|btcl)\b/i,
  // UK and Singapore operators.
  /\b(?:singtel|starhub|m1|circles\.? ?life|simba|giffgaff|vodafone|ee|lebara|lycamobile|tesco mobile|virgin media|talktalk|plusnet|bt broadband)\b/i,
  /\b(?:broadband|wi ?fi|internet|flexiload|airtime|talk ?time|data pack|internet pack|recharge (?:pack|offer|bundle))\b/i,
  // "recharge" alone is not enough: it is also what Oyster and EZ-Link cards do.
  /\b(?:mobile|phone|sim|data) (?:bill|recharge|top ?up|balance|plan|pack)\b/i,
)

// Rent and housing. ভাড়া = rent (a bare "fare" would name its vehicle).
const rent = outflow(
  'rent',
  /\brent\b(?! a car)|\b(?:house|flat|room|apartment) rental\b|\blandlord\b|ভাড়া/i,
  // Council tax is a housing cost.
  /\bcouncil tax\b/i,
)

// Groceries. The grocery arms of bigger brands sit here so they beat the parent brand
// further down: pandamart (Foodpanda), Amazon Fresh (Amazon) and GrabMart (Grab).
const groceries = outflow(
  'groceries',
  // Bangladesh.
  /\b(?:chaldal|shwapno|swapno|agora|unimart|meena ?bazaa?r|prince bazaa?r|khulshi mart|kacha bazaa?r|kancha bazaa?r|panda ?mart)\b/i,
  // UK. (Sainsbury's: the apostrophe is dropped and card statements cut the name short.)
  /\bsainsbury|\b(?:tesco|asda|lidl|aldi|morrisons|waitrose|ocado|iceland|co ?op food|m&s food)\b/i,
  // Singapore.
  /\b(?:ntuc|fairprice|sheng ?siong|cold storage|donki|redmart|prime supermarket|7 ?eleven)\b/i,
  // Delivery arms of ride and shopping apps.
  /\b(?:grab ?mart|amazon fresh)\b/i,
  /\b(?:groceries|grocery|grocer|supermarket|super ?shop|mini ?mart|convenience store)\b/i,
)

// Eating out and delivery. Before transport: Pathao Food, Uber Eats and GrabFood
// must win over Pathao, Uber and Grab.
const eatingOut = outflow(
  'eating_out',
  /\b(?:pathao|grab|uber)\W*(?:food|eats)\b/i,
  /\b(?:food ?panda|hungry ?naki|foodi|deliveroo|just ?eat)\b/i,
  // Domino's and Nando's lose the apostrophe, and card statements may cut the name
  // short ("DOMINO S"). Plain prefixes would also catch "Dominion Theatre".
  /\b(?:kfc|pizza ?hut|burger ?king|starbucks|costa coffee|greggs|wagamama|pret|kopitiam|ya kun|toast box|secret recipe|chillox|pizza inn|kacchi ?bhai|dominos?|domino s|nandos?|nando s)\b|\bmcdonald/i,
  /\b(?:restaurants?|caf[eé]|coffee|bakery|pizza|burger|biryani|canteen|food ?court|hawker|takeaway|eatery)\b/i,
)

// Transport.
const transport = outflow(
  'transport',
  // Ride-hailing, buses and taxis.
  /\b(?:uber|pathao|shohoz|obhai|grab|comfort ?del ?gro|smrt|sbs transit|transitlink)\b/i,
  /\b(?:taxi|cab|rickshaw|cng|bus|mrt|metro ?rail|parking|toll)\b/i,
  // Trains and travel cards: London, Singapore, Bangladesh.
  /\b(?:tfl|transport for london|oyster|national rail|trainline|railway|rail|train|ez ?link|simply ?go)\b/i,
  /\b(?:fuel|petrol|diesel|octane)\b/i,
)

// Travel and holidays.
const travel = outflow(
  'travel',
  /\b(?:biman|us ?bangla|novoair|air astra|emirates|qatar airways|etihad|scoot|airasia|ryanair|easyjet|british airways|jetstar|flydubai|airlines?|airways|flights?)\b/i,
  /\b(?:hotels?|resort|hostel|airbnb|booking\.com|agoda|expedia|trivago|gozayaan|sharetrip|cox ?s bazaa?r|holiday|vacation|tour)\b/i,
  /\b(?:car rental|rent a car|hertz|avis|visa (?:application|appointment|fee))\b/i,
)

// Healthcare. Before education and shopping: "Medical College Hospital" is a hospital,
// and Boots is a pharmacy.
const healthcare = outflow(
  'healthcare',
  /\b(?:pharma\w*|chemist|medicine|medical|hospital|(?:poly)?clinic|diagnostic|dental|dentist|doctor|optician|physio\w*|nhs|specsavers|boots|labaid|ibn sina|evercare)\b/i,
)

// Education. টিউশন = tuition (as an inflow it is a tutor's side income, above).
const education = outflow(
  'education',
  /\b(?:tuition|school|college|university|madrasa|madrasah|kindergarten|coaching|exam fee|coursera|udemy|edx|skillshare)\b|টিউশন/i,
)

const personalCare = outflow(
  'personal_care',
  /\b(?:salons?|parlou?rs?|barber|beauty|spa|gym|fitness|haircut|grooming|cosmetics?|superdrug|watsons|sephora|lush)\b/i,
)

const gifts = outflow(
  'gifts',
  // Zakat, fitra and sadaqah are Islamic charity.
  /\b(?:zakat|zakah|fitra|fitrah|sadaqah|sadaqa|donations?|donate|charity|gifts?|eid ?salami|oxfam|red cross|islamic relief)\b/i,
)

// Entertainment and subscriptions. Before shopping so "Amazon Prime" beats Amazon.
const entertainment = outflow(
  'entertainment',
  /\b(?:netflix|spotify|youtube|disney|hotstar|chorki|hoichoi|bioscope|prime video|amazon prime|audible|kindle unlimited|hbo|twitch|crunchyroll)\b/i,
  // Apple and Google bill the App Store, iCloud, Apple Music and Play purchases under their own name.
  // "Apple Store" is a hardware shop and "Apple Pay" a payment method, so those are left out.
  /\bapple\b(?! ?(?:store|pay))|\b(?:itunes|icloud|app store|google play|google one)\b/i,
  /\b(?:playstation|xbox|nintendo|steam (?:purchase|games?|wallet)|steampowered)\b/i,
  /\b(?:cinemas?|cineplex|cineworld|odeon|golden village|shaw theatres|movies?|concerts?|theat(?:re|er)|ticketmaster|eventbrite|subscriptions?)\b/i,
)

const shopping = outflow(
  'shopping',
  // Bangladesh.
  /\b(?:daraz|aarong|rokomari|pickaboo|startech|ryans computers|ajkerdeal|othoba|bata)\b/i,
  // Online and global.
  /\b(?:amazon|ebay|etsy|aliexpress|alibaba|temu|shein|lazada|shopee|zalora|qoo10|taobao|apple store)\b/i,
  // UK and Singapore high street.
  /\b(?:argos|ikea|primark|zara|uniqlo|john lewis|currys|b&q|tk maxx|decathlon|m&s|marks (?:and|&) spencer)\b|\bh&m\b/i,
  /\b(?:shopping|mall|boutique|fashion|clothing|garments?|electronics|furniture)\b/i,
)

// ---------------------------------------------------------------------------
// Any other fee or charge (money out). Last, so a merchant or category keyword wins.
// ---------------------------------------------------------------------------
const otherFees = outflow('fees', /\b(?:charges?|fees?|commission)\b/i)

export const RULES: readonly Rule[] = [
  ...refunds,
  ...interest,
  ...feesOnMovingMoney,
  ...ownTransfers,
  ...cashIn,
  ...cashOut,
  ...familyAndRemittances,
  ...income,
  ...loans,
  ...cardBills,
  ...buyNowPayLater,
  ...savingsAndInvestments,
  ...notIncome,
  ...utilities,
  ...mobileAndInternet,
  ...rent,
  ...groceries,
  ...eatingOut,
  ...transport,
  ...travel,
  ...healthcare,
  ...education,
  ...personalCare,
  ...gifts,
  ...entertainment,
  ...shopping,
  ...otherFees,
]
