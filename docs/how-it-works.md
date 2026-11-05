# How Arthik works: a guide for talking about it

This is for me to prepare from. It explains the architecture in plain words, the decisions I made and why, and the questions I expect. For the exact scoring rules, see [METHODOLOGY.md](../METHODOLOGY.md).

## The one-minute version

Arthik turns a list of transactions into a Financial Health Score from 0 to 100 and explains it. It is a static website: all the code runs in the visitor's browser, there is no server and no database, and the file you upload never leaves your device. The score is calculated by five documented formulas. No AI model produces it.

## Architecture in plain words

Data moves in one direction.

1. Transactions in. Either a sample person (a JSON file in `src/data/samples/`) or an uploaded CSV. The CSV parser (`src/domain/csv.ts`) checks every row and reports problems with row numbers.
2. Categorise. `categorize.ts` gives each transaction a category by matching its description against a merchant and keyword list. The visitor can override any category.
3. Measures. `measures.ts` picks the complete months (`period.ts`), converts everything to BDT (`currency.ts`) and works out the five raw numbers: savings rate, emergency savings in months, debt payments share, wants share and spending variability.
4. Score. `score.ts` turns each raw number into a 0 to 100 sub-score using the anchor points in `anchors.ts`, multiplies by the weights, and adds points in whole hundredths. It returns a result the screen can show as a ledger.
5. Explain. `reasons.ts` and `tips.ts` pick the three biggest opportunities and two to four tips from the same numbers. Every number in the wording is a placeholder in the translation file that gets filled in from the calculation.
6. Show. React components draw the score, ledger, charts and tables. They hold no scoring logic.

Everything in `src/domain/` is pure TypeScript. No React, no browser. That is what makes it testable: the unit tests exercise every anchor boundary, rounding case and missing-data rule directly.

Other parts:

- Translations. Seven message files in `src/i18n/messages/`, loaded on demand. A test fails if any key is missing from any language or its placeholders differ. Arabic flips the layout to right-to-left, which works because the CSS uses logical properties (`padding-inline-start`, not `padding-left`).
- Formatting. `format.ts` wraps `Intl`. It adds the lakh grouping and the ৳ position that `Intl` does not give for English and Bengali.
- Storage. Only the language and currency choice are saved, in `localStorage`, wrapped in try/catch so the app still works if storage is blocked. Financial data is never written anywhere.
- Exchange rates. A dated snapshot in `src/data/rates.json`, refreshed by a script. The site makes no live calls.
- Sample people. A seeded generator (`scripts/samples/`) writes the five JSON files, and a test checks the committed files equal what the generator produces.
- CI. GitHub Actions runs lint, type check, unit tests, build and the browser tests, and deploys to GitHub Pages from `main` only if they pass.

## Key decisions and why

The score is formulas, not AI. A financial health number someone might act on has to be explainable and repeatable. Same data in, same score out, and every point traces back to a line in the ledger. This also keeps the site free to run and private.

Anchored on the FinHealth Score. I did not want invented categories. The three bands and the Spend, Save, Borrow framing come from the Financial Health Network. I dropped "Plan" because transactions can't show it, and I say so openly.

Ratios, so currency doesn't matter. Every measure is a ratio or a count of months, so the score is the same whether you view it in taka, pounds or yen.

Whole hundredths and a ledger that adds up. I show each measure's points on screen, so they must sum to the total with no rounding gap. Integer hundredths remove floating-point surprises. When a measure is missing, the largest-remainder method shares out the weight and still sums exactly.

Family support is an essential. Penalising someone for sending money home would be wrong for the people this is built for.

Sample people to show "habits, not income". Farhana has nearly three times Nusrat's money in and scores lower. Rahim sends a large part of his pay home and scores highest. The tests assert this, so the claim can't go stale.

No typed numbers in explanations. Text with hard-coded figures can disagree with the chart. Placeholders make that impossible.

Nothing stored, no server. The strongest privacy promise is that the data never goes anywhere. It also removes the need for accounts, a database and a privacy policy about retention.

Anchors are judgement. I picked them from familiar rules of thumb and I list them all. They are not fitted to data, and I don't claim they are.

## Twelve questions I expect

**1. What does the score actually measure?**
Five habits you can see in transactions: how much of your income you keep, how many months of essentials your savings cover, how much of your income goes to debt, how much of your spending is wants, and how steady your spending is month to month. It is not a credit score.

**2. Why those five measures and those weights?**
They cover Spend, Save and Borrow from the FinHealth framework. Savings rate and emergency savings get 25% each because keeping money and having a cushion are the core of resilience in my judgement. The weights are judgement, not fitted, and I say that.

**3. How did you choose the anchor points?**
From common rules of thumb: saving 20%, six months of emergency savings, wants being the smaller part of spending. They are reasoned benchmarks, not statistically fitted, and are listed in the methodology so anyone can disagree.

**4. Is AI involved?**
Not in the score and not on the site. I built the project with Claude Code, and Claude helped write the translations and the sample people's summaries ahead of time. The score is plain arithmetic, tested.

**5. Why is this a responsible approach to AI in finance?**
Because the part that affects a person is transparent. You can see every number behind your score. AI helped with writing, where a mistake is visible and fixable, not with a judgement about someone's finances.

**6. What happens with privacy?**
The file is parsed in your browser and never sent anywhere. Nothing is saved, not even locally. There are no accounts, analytics or cookies. The only stored items are your language and currency.

**7. How do you handle messy real-world data?**
The CSV parser gives row-numbered errors. Unknown outgoing payments become "uncategorised" and the app shows how much. Unknown incoming payments are counted as income but flagged. Transfers between your own accounts, loans received and cash deposits are ignored so they don't look like income. A file with no complete month gets a "not enough data" message, not a wrong score.

**8. Why only complete months?**
A part-month would understate income or spending and distort stability. The rule is that the first month counts only if the data starts on or before the 7th and the last only if it reaches the final 7 days. The dashboard always names the months it used.

**9. What are the limitations?**
Plan isn't measured. Credit card payments count as debt even when paid in full. The anchors are benchmarks, not fitted. Stability looks at spending, not income. Categorising depends on the merchant list. Emergency savings is typed in.

**10. How do you know the numbers are right?**
Unit tests cover each anchor boundary, rounding and missing-data cases. A worked example in the methodology (66.80 gives 67) is a test. The ledger is checked to sum to the total. The sample people are pinned to score ranges.

**11. How did you make it work in Arabic and Bengali?**
Logical CSS properties so layout mirrors, a font per script, and `Intl` for numbers with fixes for lakh grouping. A test checks no page scrolls sideways at six widths from 320 to 1920px, in English, Bengali and Arabic. The Bengali translation gets my own review before launch, since I can read it and the AI might not be right.

**12. What would you do next?**
Add more merchants and local data sources, add a "Can I afford it?" assistant with a live model (with the score staying formula-based), and test the anchor points against real survey data if I could get access to it. I'd also want real user feedback on the explanations.
