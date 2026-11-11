# How the Arthik score works

This is the full method. Every number below is a constant in the code: the anchors are in `src/domain/anchors.ts`, the weights, bands and rounding are in `src/domain/score.ts`, the complete-month rule is in `src/domain/period.ts`, the measures are in `src/domain/measures.ts` and the categories are in `src/domain/categories.ts`. The "How the score works" page in the app is generated from the same constants. This file is written by hand, so if the two ever differ, the code is right.

Arthik is an educational tool. It is not financial advice and not a credit score. Your data stays in your browser and is never uploaded.

## 1. Where the idea comes from

The score is inspired by the Financial Health Network's FinHealth Score. That framework has four pillars (Spend, Save, Borrow, Plan) and three bands: Financially Vulnerable (0 to 39; Arthik calls its band Vulnerable), Coping (40 to 79) and Healthy (80 to 100). The FinHealth Score is survey-based. Arthik uses measures you can calculate from transactions, which cover Spend, Save and Borrow. **Plan** (insurance, retirement, goals, confidence about the future) cannot be read from a list of transactions, so Arthik does not measure it. It uses the same three bands.

References: Financial Health Network, *FinHealth Score Toolkit* (2021), and "Eight Ways to Measure Financial Health".

The score is always calculated by the formulas on this page. No AI model produces it, and nothing is sent anywhere.

## 2. What goes in

Each transaction has a date, a description, an amount (positive for money in, negative for money out), a currency and a category. A file can give the amount as one signed column, or as separate debit and credit (or withdrawal and deposit) columns. The category is assigned automatically from a built-in list of merchants and keywords, and you can change it in the transactions table. The template file includes two money-in rows that Arthik can't recognise, so you can see how they are flagged.

All amounts are converted to BDT using a bundled snapshot of exchange rates (ExchangeRate-API, dated 3 November 2026; refresh it with `npm run rates:update`). Every measure below is a ratio, so the score does not change with the currency you display.

### Categories and what the score does with them

| Group | Categories | Treatment |
|---|---|---|
| Income | Salary, Freelance income, Side income, Family support received, Remittance received, Other income | Counts as income |
| Essentials (needs) | Rent and housing, Utilities, Groceries, Transport, Education, Healthcare, Mobile and internet, Family support sent, Fees and charges | Spending (needs) |
| Wants | Eating out and delivery, Shopping, Entertainment and subscriptions, Travel and holidays, Personal care | Spending (wants) |
| Other spending | Gifts and donations | Spending, neither a need nor a want |
| Debt payments | Loan instalment (EMI), Credit card payment, Buy-now-pay-later instalment | Counts toward debt payments. Not spending. |
| Savings and investments | Savings deposit or Deposit Pension Scheme (DPS), Sanchayapatra and investments | Not spending. Money kept. |
| Cash | Cash withdrawal | Spending, because cash is assumed spent. Left out of needs vs. wants. The cash-out charge goes to Fees and charges. |
| Refunds | Refund or reversal | Reduces total spending. Not income. |
| Not counted | Own-account transfer, Cash deposit, Savings withdrawal, Loan received | Ignored entirely, so moved or borrowed money never looks like income and nothing is counted twice |
| Uncategorised money out | Any outgoing payment not recognised | Spending, left out of needs vs. wants. The app shows how much of your spending is uncategorised. |
| Unrecognised money in | Any incoming payment not recognised | Counted as Other income by default and flagged in the transactions table so you can change it |

Money sent to family counts as an essential, not a want. Supporting family is a core obligation for many Bangladeshi households and migrant workers, and the score should not penalise it.

## 3. Which months are used

The score looks at the most recent **complete calendar months** in your data, at most 12.

- Every month between the first and last month of the data counts.
- The first month counts only if the earliest transaction is on or before the 7th.
- The last month counts only if the latest transaction falls in the final 7 days of that month.
- If more than 12 months qualify, the latest 12 are kept.
- Transactions outside the months used are ignored.

The dashboard always says which months it used, for example "Using 3 complete months: Aug to Oct 2026". A file with no complete month (data from 1 to 3 November only, say) gets a plain "not enough data" message instead of a score.

## 4. The five measures

Each measure becomes a sub-score from 0 to 100 by straight-line steps between anchor points. Below the first anchor or above the last, the sub-score stays flat.

| # | Measure | Weight | Formula | Anchors (value gives sub-score) |
|---|---|---|---|---|
| 1 | Savings rate | 25% | (Income - Spending - Debt payments) / Income | -10% gives 0, 0% gives 30, 10% gives 70, 20% or more gives 100 |
| 2 | Emergency savings | 25% | Emergency savings you enter / average monthly Essentials, in months | 0 gives 0, 1 gives 40, 3 gives 80, 6 or more gives 100 |
| 3 | Debt payments | 20% | Debt payments / Income | 0% gives 100, 10% gives 90, 20% gives 70, 36% gives 30, 50% or more gives 0 |
| 4 | Needs vs. wants | 15% | Wants / (Essentials + Wants) | 20% or less gives 100, 30% gives 80, 40% gives 50, 60% or more gives 0 |
| 5 | Spending stability | 15% | Standard deviation of monthly spending / mean monthly spending | 0.10 or less gives 100, 0.25 gives 60, 0.50 or more gives 0 |

Notes on the formulas:

- Spending is essentials, wants, other spending, cash withdrawals and uncategorised money out, minus refunds. Debt payments and savings are not spending.
- Savings rate is the only measure that can go below zero. Below -10% it scores 0.
- Emergency savings is the amount you enter divided by your average monthly essentials. It reads as "months of essential spending covered". It does not claim how long you would last if your income stopped.
- Needs vs. wants ignores cash withdrawals, other spending and uncategorised money, because they cannot be called needs or wants.
- Spending stability uses the population standard deviation (divide by the number of months), because the months are the whole period, not a sample. It needs at least 3 complete months. It measures spending, not income.

The anchors are reasoned benchmarks, not values fitted to data. They lean on familiar rules of thumb, like saving a fifth of income and keeping six months of essentials, and on my judgement that debt payments get hard to carry well before they reach half of income. You may disagree. That is why they are all listed here.

## 5. Putting the score together

1. Each sub-score is rounded to a whole number (halves round up).
2. Each measure's **points** = sub-score x weight. Points are kept as whole **hundredths** of a point (58 x 25% = 14.50 is stored as 1450), so the ledger on screen adds up exactly and nothing drifts from floating-point arithmetic.
3. The **total** is the sum of the points.
4. The **overall score** is the total rounded to a whole number, with .50 rounding up. The ledger column always sums to the total exactly.

Worked example (the one on the "How the score works" page): sub-scores 58, 44, 100, 56 and 86 give 14.50 + 11.00 + 20.00 + 8.40 + 12.90 = 66.80, which scores **67**.

### Bands

| Score | Band |
|---|---|
| 0 to 39 | Vulnerable |
| 40 to 79 | Coping |
| 80 to 100 | Healthy |

The band is shown by name in text and by tick marks at 40 and 80 on the scale. Colour is never the only signal.

## 6. Missing or too little data

A measure that cannot be calculated shows "Not scored" with the reason, and its weight is shared among the measures that can be scored, in proportion to their weights. The score page then says "Based on N of M measures", and for an uploaded file with no emergency savings it offers a field to add them there.

| Situation | What happens |
|---|---|
| You did not enter emergency savings | Emergency savings is Not scored until you add it, either with your file or on the score page |
| No essentials spending in the period | Emergency savings is Not scored |
| Fewer than 3 complete months | Spending stability is Not scored |
| No spending at all | Needs vs. wants is Not scored |
| No income in the period | Savings rate and Debt payments are Not scored, and no overall score is shown. The app asks you to add your income transactions. |
| Fewer than 3 measures can be scored | No overall score is shown |
| No complete month | No overall score is shown |

**Re-weighting and rounding.** When some measures are missing, each scored measure's exact share is sub-score x weight x 100 / (sum of the scored weights), in hundredths of a point. Each share is rounded down, and the leftover hundredths go one each to the measures with the largest remainders (ties go to the earlier line in the ledger). The total is the exact sum of the shares, rounded half up, so the ledger still sums to the total exactly. With all five scored, the weights add to 100 and every share is already a whole number of hundredths.

## 7. Reasons and tips

- Top 3 reasons: the three measures with the most points to gain, calculated as weight x (100 - sub-score). Each reason gives your own number and the benchmark. If every scored measure is 80 or above, the reasons become strengths instead.
- Tips: two to four tips chosen by rules from your own data, for example a tip about delivery spending with your actual monthly amount. The checks on your data (uncategorised spending, unrecognised income) always keep their place. The save-on-payday tip is offered only when your savings rate is zero or above and below the 20% that earns full points. Its amount is what you would need to not spend each month to reach that rate. The savings rate rises by spending less, not by moving money.
- Every number in every explanation is filled in from the calculation through placeholders in the translation text. Hand-written text never contains typed numbers, so the text and the charts cannot disagree.

Uploaded files get these rule-based reasons and tips. The five sample people also have a short written summary (see section 9).

## 8. The what-if sliders

Three sliders recalculate the score immediately and show the change, for example "62 to 71, +9":

1. Cut wants spending by 0 to 50%.
2. Extra monthly income, from 0 up to 50% of current monthly income.
3. Add to emergency savings, a one-off amount from 0 up to 6 months of essential spending.

They are a simulation. The underlying data does not change. Changing language or currency keeps your data and resets the sliders to "no change".

## 9. The sample people

All five are fictional, each with six complete months (May to October 2026) of generated transactions. The generator is seeded, so the data is reproducible (`npm run gen:samples`). The tests assert each person's score range and band:

| Person | Situation | Asserted score range | Band |
|---|---|---|---|
| Nusrat | University student, Dhaka | 60 to 69 | Coping |
| Tanvir | Freelance developer, paid in USD | 70 to 79 | Coping |
| Farhana | Office worker, Dhaka | 25 to 39 | Vulnerable |
| Arif | Bangladeshi MSc student, UK | 50 to 59 | Coping |
| Rahim | Construction worker, Singapore | 80 to 92 | Healthy |

The set shows that the score measures habits, not income. Farhana has nearly three times Nusrat's money coming in (the tests require at least 2.7 times and less than 3 times) and scores lower. Rahim sends at least 40% of his pay home and still scores highest. The five written summaries were produced with Claude and use placeholders for every number.

## 10. Limitations

- Plan is not measured. Insurance, retirement planning and goals cannot be read from transactions.
- Credit card payments count as debt payments, even when you pay in full. If your file also holds the card's own purchases, mark the bill payment as an Own-account transfer, or the same money is counted twice.
- The anchors are reasoned benchmarks, not statistically fitted to outcomes.
- Spending stability looks at spending, not income. A freelancer with irregular income and steady spending is not penalised here.
- Uploads are only as good as the categories. Automatic categorising works from a merchant and keyword list. Check the uncategorised share and the flagged incoming payments.
- Emergency savings is self-reported. It is not read from your transactions.
- Exchange rates are a dated snapshot, not live.
- It is not a credit score and is not used for lending decisions.
- Translations were produced with AI assistance. I reviewed the Bengali myself. The other languages were checked by a second AI pass, not by native speakers.
