# Arthik (আর্থিক): Design Document

**Date:** 3 November 2026
**Owner:** Rubayet Rezwan (GitHub: `rubayetrezwan`)
**Status:** Draft for approval

---

## 1. Intent and the why

Arthik is a small website. It reads a person's bank or mobile-wallet transactions and gives them a **Financial Health Score from 0 to 100**. It explains in plain language **why** they got that score and **how** to improve it.

The project's real job is to be a portfolio piece for a scholarship application to the **MSc Financial Technology at Warwick Business School**. Its audience is an admissions and scholarship committee. They will spend about a minute on it, and they want to see three things:

1. **Finance knowledge.** The score rests on real, published financial-health measures, not invented ones.
2. **Responsible, explainable AI.** The number is calculated by transparent formulas, never by an AI model. Every score can be traced back to the person's own numbers. This is a recurring theme at Warwick's Gillmore Centre for Financial Technology.
3. **Real-world relevance.** The app is built for people in Bangladesh and the Bangladeshi diaspora. BDT is the main currency, it supports Bengali, and the sample data uses real local spending patterns (bKash, Nagad, DESCO bills, DPS savings). That gives it a financial-inclusion story.

It connects to four of the course's core modules: Foundations of Finance, FinTech for Consumer Financial Services, Programming and Big Data Analytics, and Generative AI. It also connects to the Gillmore Centre's research on consumer fintech, financial literacy and explainable AI.

The owner will be asked about it in interviews. Everything must be explainable in plain words, and the repository must include a clear write-up of how it works.

## 2. Goals, non-goals, anti-goals

### Goals
- A live, public website anyone can open in one click, with nothing to install.
- Five ready-made sample people the visitor can explore instantly.
- Visitors can upload their own transactions as a CSV file and get a score.
- English is the default language. The site is also fully available in Bengali, Hindi, Arabic, Chinese (Simplified), Spanish and French (**7 languages**).
- BDT is the default currency. Ten more currencies are available: the BIS 2025 top 10, which are USD, EUR, JPY, GBP, CNY, CHF, AUD, CAD, HKD and SGD (**11 currencies**).
- A polished GitHub repository: a README with screenshots, a methodology write-up, automated tests and a live link.
- No mistakes visible to a reviewer. That means no broken translations, no wrong numbers, no layout bugs in right-to-left (RTL) Arabic and no console errors.

### Non-goals (deliberately not in this version)
- Connecting to real bank accounts or Open Banking.
- Reading PDF bank statements. Uploads are CSV only.
- User accounts, logins or a server/database.
- Live AI calls from the website. The owner chose a fully free, no-API-key setup.
- A "Can I afford it?" chat. It needs live AI, so it's a possible future feature.
- Credit scoring or lending decisions.
- A mobile app. The website must work well on phones.

### Anti-goals (things that would make this a failure even if it "works")
- **An AI model producing the score.** The score must always come from documented formulas.
- **The user's financial data leaving their device.** Everything is processed in the browser. No analytics, no tracking, no cookies and no third-party calls with user data.
- **Misleading claims.** The app must never call itself a credit score, financial advice or "bank-grade". It shows a clear disclaimer.
- **Visible translation bugs.** Raw keys like `score.title` showing on screen, missing text, or broken Arabic right-to-left layout.
- **Text that disagrees with the numbers.** An explanation must never say "you save 12%" when the chart shows 9%.
- **Jargon a non-finance visitor can't follow.**

## 3. Constraints

- **Cost:** £0/$0 to run. Hosting is on GitHub Pages under the owner's account (`rubayetrezwan.github.io/arthik`, repo `arthik`). No paid services and no API keys.
- **Fully static site:** all logic runs in the visitor's browser.
- **Default language:** always English. The site does not switch automatically based on the browser's language. The visitor's choice is remembered on their device.
- **Default currency:** always BDT. The visitor's choice is remembered.
- **Built with Claude Code.** The README says so honestly.
- **Owner approval:** publishing the repository publicly and turning on GitHub Pages happen only after the owner approves in chat.

## 4. What the owner decided

| Decision | Choice |
|---|---|
| Project | Financial Health Score |
| Name | **Arthik (আর্থিক)**, Bengali for "financial" |
| Languages | English (default), Bengali, Hindi, Arabic, Chinese (Simplified), Spanish, French |
| Currencies | BDT (default), USD, EUR, JPY, GBP, CNY, CHF, AUD, CAD, HKD, SGD |
| Sample people | Mostly Bangladesh-based, plus Bangladeshis abroad |
| AI on the site | None live. Claude writes the sample people's explanations ahead of time, and uploads get template-based explanations. |

## 5. How the score works

### 5.1 Grounding

The score is **inspired by the Financial Health Network's FinHealth Score**. That framework uses four pillars (Spend, Save, Borrow, Plan) and three bands: **Financially Vulnerable (0–39), Coping (40–79) and Healthy (80–100)**. FinHealth is survey-based. Arthik uses measures that can be **calculated from transactions**, which cover Spend, Save and Borrow. "Plan" can't be measured from transactions, and the methodology write-up must say so plainly. Arthik uses the same three bands.

Reference: Financial Health Network, *FinHealth Score Toolkit* (2021), and "Eight Ways to Measure Financial Health".

### 5.2 Transaction model

Each transaction has:
- `date`: a calendar date
- `description`: free text, for example "bKash Cash Out 01712xxxxxx"
- `amount`: positive for money in, negative for money out
- `currency`: one of the 11 supported codes
- `category`: one of the categories below. It is assigned automatically, and the visitor can change it.

### 5.3 Categories and groups

| Group | Categories | How the score treats it |
|---|---|---|
| **Income** | Salary, Freelance income, Side income (e.g. tutoring), Family support received, Remittance received, Other income | Counts as income |
| **Essentials (needs)** | Rent & housing, Utilities (electricity, gas, water), Groceries, Transport, Education, Healthcare, Mobile & internet, Family support sent, Fees & charges | Counts as spending (needs) |
| **Wants** | Eating out & delivery, Shopping, Entertainment & subscriptions, Travel & holidays, Personal care | Counts as spending (wants) |
| **Other spending** | Gifts & donations | Counts as spending, but is neither a need nor a want |
| **Debt payments** | Loan EMI, Credit card payment, Buy-now-pay-later instalment | Counts toward debt load. It is not spending. |
| **Savings & investments** | Savings deposit / DPS, Sanchayapatra & investments | Not spending. It is money kept. |
| **Cash** | Cash withdrawal (ATM, bKash/Nagad/Rocket cash-out) | Counts as spending, because cash is assumed to be spent. It is left out of the needs-vs-wants measure. The cash-out *charge* goes to Fees & charges. |
| **Refunds** | Refund or reversal | Reduces total spending. It is not income. |
| **Not counted** | Own-account transfer (e.g. bank to bKash top-up), Cash deposit (agent cash-in), Savings withdrawal (e.g. breaking a DPS), Loan received (loan disbursement) | **Ignored entirely.** This avoids double counting and stops borrowed or moved money from looking like income. |
| **Uncategorised money out** | Any outgoing payment not recognised | Counts as spending, but is left out of the needs-vs-wants measure. The app shows a prompt: "X% of your spending is uncategorised; sort it for a more accurate score." |
| **Unrecognised money in** | Any incoming payment not recognised (e.g. "Received from 01712…") | Counted as **Other income** by default, because most money arriving in a personal account is income or family support. Each one is flagged in the review table ("Not recognised: counted as income. Check it."), so the visitor can change it to a transfer or loan. |

Sending money to family is counted as an **essential**, not a want. Supporting family is a core obligation for many Bangladeshi households and migrant workers, and the app must not penalise it.

**One upload, possibly several accounts.** An upload is a single CSV file. The visitor may combine several accounts in it (e.g. bank plus bKash). Two rules prevent double counting:
- Moving money between your own accounts goes in the *Not counted* group.
- A credit card bill payment counts as a debt payment by default. If the file also contains the card's own purchases, the visitor should mark the bill payment as an *Own-account transfer*. The upload help text and the methodology page explain this.

If a file has no income at all (common for a wallet-only export), the app shows: "This file has no income. Add the account your income arrives in to get a score."

### 5.4 The five measures

All amounts are converted into one base currency (BDT) using the bundled exchange rates before any calculation (see 7.2). Every measure is a **ratio**, so the score does not change with the display currency.

The scoring period is the **most recent complete calendar months** in the data, from a minimum of 1 month (some measures need more, see below) to a maximum of 12.

**Which months count as complete:**
- Every month between the first and last month of the data counts.
- The **first** month counts only if the earliest transaction is on or before the 7th.
- The **last** month counts only if the latest transaction falls within the final 7 days of that month.

The dashboard always shows which months were used, e.g. "Using 3 complete months: Aug–Oct 2026". Visitors then never have to guess why a month was dropped.

Each measure becomes a 0–100 sub-score using **straight-line steps between anchor points**, capped at 0 and 100.

| # | Measure | Weight | Formula | Anchor points (value → sub-score) |
|---|---|---|---|---|
| 1 | **Savings rate** | 25% | (Income − Spending − Debt payments) ÷ Income | −10% → 0 · 0% → 30 · 10% → 70 · 20%+ → 100 |
| 2 | **Emergency buffer** | 25% | Savings available for emergencies ÷ average monthly Essentials spending, in months | 0 → 0 · 1 → 40 · 3 → 80 · 6+ → 100 |
| 3 | **Debt load** | 20% | Debt payments ÷ Income | 0% → 100 · 10% → 90 · 20% → 70 · 36% → 30 · 50%+ → 0 |
| 4 | **Needs vs. wants** | 15% | Wants ÷ (Essentials + Wants) | ≤20% → 100 · 30% → 80 · 40% → 50 · 60%+ → 0 |
| 5 | **Spending stability** | 15% | Coefficient of variation (standard deviation ÷ mean) of monthly spending | ≤0.10 → 100 · 0.25 → 60 · 0.50+ → 0 |

**Overall score.** Each sub-score is rounded to a whole number first. Each measure's **points** = sub-score × weight. These are always exact to 2 decimal places (e.g. 58 × 25% = 14.50), so the ledger on screen adds up exactly. The **overall score** is the total points rounded to a whole number, with .50 rounding up. Example: 14.50 + 11.00 + 20.00 + 8.40 + 12.90 = 66.80 → **67**. Calculations should use integer arithmetic (hundredths of a point) to avoid floating-point drift.

**Bands:** 0–39 Vulnerable · 40–79 Coping · 80–100 Healthy.

**Missing or too little data.** If a measure can't be calculated, it shows "Not scored" with the reason. Its weight is shared out among the remaining measures in proportion to their weights.
- *Emergency buffer:* the visitor didn't enter their savings amount.
- *Spending stability:* fewer than 3 complete months of data.
- *Savings rate and debt load:* there's no income in the period. With no income, the overall score is **not shown**. Instead the app shows "Add your income transactions to get a score."
- If fewer than 3 measures can be scored, no overall score is shown.

The **methodology page** and `METHODOLOGY.md` must show every formula, weight and anchor point, explain the reasoning in plain language, and list the limitations. The limitations include:
- "Plan" isn't measured.
- Credit card payments are treated as debt payments even when paid in full.
- The anchor points are reasoned benchmarks, not statistically fitted.
- Spending stability looks at spending, not income.

### 5.5 Explanations ("why this score")

- **Top 3 reasons:** the three measures with the most points to gain, calculated as weight × (100 − sub-score). Each reason states the person's own number and the benchmark. Example: "You kept 6% of your income. Keeping 20% or more scores full marks."
- If every scored measure is 80 or above, the reasons become **strengths** instead.
- **Tips:** 2–4 tips picked by rules from the person's data. Example: if wants are high and the biggest want is "Eating out & delivery", show a tip about delivery spending with their actual monthly amount.
- **Every number in every explanation is filled in from the calculation**, through placeholders in the translation text. Hand-written text never contains typed numbers. This makes it impossible for text and charts to disagree.

### 5.6 Sample people: pre-written explanations

Each of the 5 sample people also gets a short, richer **personal summary** (3–5 sentences) written by Claude during the build, in all 7 languages. The same placeholder rule applies: numbers are never typed into the text. The README says these were written with Claude and reviewed.

Uploaded data gets the rule-based reasons and tips from 5.5, without the personal summary.

### 5.7 "What if" sliders

Three sliders recalculate the score instantly and show the change (e.g. "62 → 71, +9"):
1. **Cut wants spending** by 0–50%.
2. **Extra monthly income**, from 0 up to 50% of current monthly income.
3. **Add to emergency savings**, a one-off amount from 0 up to 6 months of essential spending.

The sliders don't change the underlying data. They're a simulation only.

## 6. The five sample people

All names and data are fictional. Each person has **6 complete months** of realistic transactions, generated by a seeded script so the data is reproducible, then committed as data files. Descriptions use real local merchant names for realism (e.g. bKash, Nagad, Rocket, DESCO, DPDC, Titas Gas, Daraz, Foodpanda, Pathao, Chaldal, Shwapno, Grameenphone, Robi; Tesco, TfL; FairPrice, Singtel).

Together they cover the full range of bands, which shows the score isn't simply rewarding high income.

| Person | Situation | Money in | Key traits | Target band |
|---|---|---|---|---|
| **Nusrat**, university student, Dhaka | Lives in a shared mess, tutors part-time | BDT: family allowance + tutoring income (about ৳23,000/month) | Frequent Foodpanda, bKash cash-out fees, small savings, no debt | Coping (around 60s) |
| **Tanvir**, freelance developer, Dhaka | Paid in **USD** by overseas clients and spends in **BDT** (mixed currency) | USD, irregular month to month | Monthly DPS savings, no debt, uneven spending | Coping (around 70s) |
| **Farhana**, office worker, Dhaka | Salaried, renting a flat | BDT salary (about ৳65,000/month) | Personal loan EMI, credit card bill (she carries a balance), heavy Daraz shopping paid by bKash, little savings | Vulnerable (around 30s) |
| **Arif**, Bangladeshi MSc student, UK | Studying in the UK, part-time job | **GBP**: part-time wages + family support received | Tesco, rent, transport, modest savings | Coping (around 50s) |
| **Rahim**, construction worker, Singapore | Lives in employer-provided dorm | **SGD** salary, steady (about SGD 1,500/month) | Sends nearly half his salary home every month, very steady spending, solid savings | Healthy (80+) |

The set is built to show that **the score measures habits, not income**:
- Farhana earns nearly three times what Nusrat has coming in, yet scores lowest.
- Rahim sends almost half his salary home every month and still scores highest.

The README, the "how it works" guide and the summaries must make this point in these terms. They must **not** claim anyone has "the lowest income", because the currency switcher would show that isn't true.

## 7. Languages, currencies, numbers

### 7.1 Languages
- **English** (default; the source text), **Bengali**, **Hindi**, **Arabic**, **Chinese (Simplified)**, **Spanish**, **French**.
- A language switcher is visible on every page. The choice is remembered on the device.
- **Arabic** switches the whole layout to right-to-left. That covers the page direction, navigation, sliders, charts' reading order where it makes sense, and icons that imply direction.
- **Every** piece of visible text is translated, including errors, chart labels, category names, the CSV upload messages and the disclaimer.
- Translations are AI-assisted by Claude, and the README says so. The owner will review the **Bengali** translation before publishing.
- Each script must render correctly with proper fonts: Bengali, Devanagari (Hindi), Arabic and Chinese.

### 7.2 Currencies and exchange rates
- BDT is the default display currency, and 10 more are selectable.
- Exchange rates are a **bundled snapshot**: a data file with all 11 currencies against BDT, the date, and the source name. The app shows "Exchange rates as of [date], source: [source]." It makes no live calls. The builder chooses a reputable source, records it, and refreshes the snapshot at build time.
- Each transaction keeps its original currency. Everything is converted to BDT for calculation and to the chosen currency for display.

### 7.3 Number formatting
- BDT amounts use the **৳** symbol and **South Asian digit grouping** (e.g. ৳1,00,000 rather than ৳100,000) in English and Bengali.
- Bengali shows Bengali digits (০–৯).
- Other languages follow their standard number and date formatting.

**Verified in Chrome on 3 Nov 2026 (the builder must still cover these with tests):**
- `Intl` with locale `en-BD` does **not** use lakh grouping (it gives 150,000). English BDT amounts must be formatted with `en-IN` grouping and a ৳ prefix: **৳1,50,000**.
- `bn-BD` gives lakh grouping and Bengali digits, but CLDR puts ৳ *after* the number. Arthik puts it **before** (**৳১,৫০,০০০**), matching how bKash and other Bangladeshi apps show it.
- `hi-IN` with `currencyDisplay: "narrowSymbol"` gives **৳1,50,000**.
- `ar` uses Western digits (0–9) in current Chrome. Arthik keeps the locale default and does not force Arabic-Indic digits.
- Spanish and French follow their own conventions (150.000 ৳ and 150 000 ৳).
- BDT and JPY amounts show **no decimals**. Other currencies show 2.
- Signed amounts (−৳640) are wrapped in `<bdi>` so the sign stays attached in right-to-left text.

## 8. Uploading your own data

- **Format:** a CSV with columns `date`, `description`, `amount`, plus optional `currency` (defaults to the chosen currency) and optional `category`. The visitor can download a template CSV from the page.
- **Clear validation errors** in the chosen language, with row numbers. Examples: "Row 14: date not recognised".
- **Automatic categories** come from a built-in list of known merchants and keywords covering Bangladesh, the UK, Singapore and common global ones. Anything unknown is marked "Uncategorised".
- **Review table:** the visitor can change any transaction's category with a dropdown, and the score updates.
- **Emergency savings:** an optional field asks how much the visitor has in savings they could use in an emergency.
- **Privacy:** the file never leaves the browser and nothing is saved. Refreshing the page clears it, and the page states this plainly.

## 9. What the visitor sees

1. **Home page:** what Arthik is in one sentence, buttons to try a sample person or upload your own, a privacy note, and a "how the score works" link.
2. **Score dashboard:**
   - the score with its band, shown on a three-band scale
   - **a ledger showing how the score adds up**: each measure's own number, its score out of 100 with a bar, how much it counts, its points, and the total, double-ruled like an account book
   - the top 3 reasons and the tips
   - the personal summary (sample people only)
   - the "what if" sliders
   - a spending-by-category chart and a monthly income vs. spending chart
   - the transactions table
3. **How the score works:** the methodology in plain language, with every formula and the limitations.
4. **About:** who built it, why, "built with Claude Code", the disclaimer, and links to the source code.

A disclaimer is visible on the dashboard: "Arthik is an educational tool. It is not financial advice and not a credit score."

**Quality bar:**
- Works well on phones and desktops.
- Keyboard accessible, with good colour contrast (WCAG AA).
- Charts have text alternatives.
- No console errors.

## 9a. Visual design: "Hal khata"

**Chosen direction:** A, the ledger. It was chosen over a generic "calm modern" direction after an independent design critique. The reference mockups are in `docs/design/mockups/`. `dashboard-v2.html` is the main reference; `scripts.html` shows all 7 scripts.

**The idea.** The *hal khata* is the red cloth-bound ledger book Bengali shopkeepers open at Pohela Boishakh. Arthik borrows its language, and every motif has a meaning:
- the red double rule under the header
- an accounting **double underline** under final totals: the score itself, and the ledger total
- serif figures
- hairline-ruled sections instead of a grid of identical cards
- a slightly rotated, ruled "stamp" for the band label

**Tokens.** The builder may refine these, but must keep the contrast ratios.

| Token | Value | Use |
|---|---|---|
| bg | #F4EFE4 | page (paper) |
| surface | #FBF8F1 | sheets, inputs |
| ink / ink-2 | #1E1B16 / #5A5347 | text / secondary text (6.6:1 or better) |
| rule | #DDD3C0 | hairlines (decorative only) |
| control | #8A7D69 | borders of inputs and buttons (3:1 or better) |
| primary | #0E5A43 | links, primary actions (bottle green) |
| red | #9C2A22 | brand rules, numerals in lists, wordmark Bengali |
| vulnerable / coping / healthy | #9A3324 / #7A5209 / #1F6B45 | band text (4.5:1 or better on surface) |
| zone tints | #E8C4B8 / #EAD39C / #C3DCC8 | band zones. **Never the only signal:** always paired with 1px ink ticks at 40 and 80 and the band's name in text |

**Type, per script.** Load only the fonts the active language needs.
- **Latin:** Newsreader for display and figures, IBM Plex Sans for body.
- **৳ sign** (not in either Latin font): Tiro Bangla in the display stack and Noto Sans Bengali in the body stack, as fallbacks.
- **Bengali:** Tiro Bangla for display, Noto Sans Bengali for body.
- **Hindi:** Tiro Devanagari Hindi for display, IBM Plex Sans Devanagari for body.
- **Arabic:** Noto Naskh Arabic for display, IBM Plex Sans Arabic for body.
- **Chinese:** Noto Serif SC for display, Noto Sans SC for body.
- **Line heights:** Bengali and Hindi use 1.75 for body text and 1.4 for headings. Arabic and Chinese use about 1.7.
- **No letter-spacing and no forced uppercase** anywhere. Small labels use the display face in italic, sentence case.
- **Minimum text size** is 14px, so Bengali conjuncts stay readable.

**Layout rules:**
- Only the score and the ledger are boxed "sheets". Everything below the red divider ("Explore your money") is ruled sections.
- **Spacing scale:** 4, 8, 12, 16, 24, 32, 56.
- **Square-ish corners** (2–3px). No pill shapes, no soft drop shadows, no gradients, no emoji.
- **Logical CSS properties throughout** (`inset-inline-start`, `padding-inline` and so on), so Arabic mirrors correctly. The what-if arrow is mirrored too.
- **Touch targets** are at least 44px tall. Mobile at 375px has no sideways scrolling, and the ledger and the transactions table stack into rows.
- On mobile, the sample-person switcher should use an even grid or a select, so one name doesn't wrap alone onto a second line, as it does in the mockup.

**Copy rules:**
- Second person ("you") throughout, including for sample people. The page says "Sample: Nusrat, …" at the top.
- One name per idea: **Emergency savings** (not buffer or safety net), **Debt payments** (not debt load), **How the score works** (not methodology page).
- No jargon without a plain explanation. Spell out DPS as "Deposit Pension Scheme (DPS)".
- Percentages are whole numbers. Months use one decimal.
- "Worth up to N more points", not game-like wording.
- Every amount in a tip must be exactly the thing it names. Example: "Eating out and delivery averaged ৳3,850", not "food delivery", when the number is the whole category.

**Accessibility:**
- A skip link.
- Real headings.
- The ledger is a real `<table>`.
- Chart bars have text alternatives and a "Show as table" option.
- Sliders step in sensible amounts (5%, ৳500) with spoken values.
- The what-if result is announced politely and once per change, not on every step.

## 9b. Devices

The owner wants Arthik to work well on **every device: phones, tablets, laptops and desktop PCs**.

**Screen sizes that must look deliberate, not just fit:**

| Device | Widths to design and test | Notes |
|---|---|---|
| Small phone | 320–389px | Nothing cut off at 320px. Ledger and transactions stack into rows. |
| Phone | 390–767px, portrait **and landscape** | Landscape phones (e.g. 812×375) keep the header compact so content stays visible. |
| Tablet portrait | 768–1023px | One column. The score card and ledger stack. |
| Tablet landscape / small laptop | 1024–1279px | Two columns. At this width the ledger must not wrap its column headings. Use a shorter heading or move the ledger under the score card until there's room (the mockup squeezes "Counts for" onto two lines at 1024px). |
| Laptop / desktop | 1280–1919px | Content max width about 1160px, centred. |
| Large monitor | 1920px and up | Same max width, so line lengths stay readable. Nothing stretches edge to edge. |

**Input and browser support:**
- **Touch, mouse and keyboard** all work everywhere. Nothing depends on hover. Every tap target is at least 44px. The sliders work by dragging, tapping and arrow keys.
- **Browsers:** the latest two versions of Chrome, Edge, Firefox and Safari on desktop, plus Safari on iPhone/iPad and Chrome/Samsung Internet on Android.
- Respects **browser zoom up to 200%** and the system text size, without breaking the layout.
- Respects **reduced motion** and safe areas on notched phones (`viewport-fit=cover` with safe-area padding on fixed elements).

**Installable app (Claude's call).** Arthik will be a **Progressive Web App**:
- It can be installed from the browser to a phone's home screen, a tablet, or a Windows/Mac computer, with a proper icon and name.
- Once loaded, it works **offline**. That fits the privacy story: nothing ever needs the network.
- It uses a well-tested plugin with **automatic updates**, so visitors never get stuck on an old version. The service worker never caches uploaded data, because data is never stored.

**How it's tested:**
- The end-to-end browser tests run on device profiles for desktop Chrome, desktop Firefox, desktop Safari (WebKit), iPad (portrait and landscape), an Android phone and an iPhone.
- An automatic check on every page and language fails the build if any page scrolls sideways at 320, 375, 768, 1024, 1280 or 1920px.

## 10. Repository and delivery

- Public GitHub repository `arthik` under `rubayetrezwan`, published only after the owner's approval.
- Deploys automatically to GitHub Pages from the main branch via GitHub Actions.
- Every push runs the automated checks:
  - type checking and linting
  - unit tests (every scoring formula and anchor boundary, currency conversion, CSV parsing, categorisation, missing-data rules)
  - **translation completeness** (every text key exists in all 7 languages, with matching placeholders)
  - end-to-end browser tests (load each sample person, switch to every language including Arabic RTL, switch currency, upload the template CSV, move the sliders)
  - an automated accessibility check
- **README:** live link, screenshots, what and why, how the score works (summary), privacy, tech used, how to run it locally, built with Claude Code, limitations and future ideas.
- `METHODOLOGY.md`: the full scoring method.
- A plain-language **"how it works"** guide for the owner to prepare for interviews. It covers the architecture, the key design decisions and likely interview questions with answers. This can live in the repository as `docs/how-it-works.md`.
- MIT licence.

**Release:** there's no deadline. Everything launches together: all 7 languages, 11 currencies and 5 sample people. Nothing goes public until the full set is finished, tested, and the owner has reviewed the Bengali.

## 11. Left to the builder

- Tech stack, within the constraints (fully static, runs in the browser, typed, testable). The owner hasn't chosen one. The suggestion is React + TypeScript + Vite, with a standard internationalisation library, a chart library and a CSV parser.
- Visual design, colours, typography and the chart library.
- Exact transaction amounts for each sample person, within the targets in section 6.
- The contents of the merchant/keyword list.
- The exchange-rate source, as long as it's reputable and recorded.
- Routing and URL structure, including whether the language appears in the URL.
- Whether to add a dark mode.

## 12. Calls Claude made (the owner can overrule)

- **Fully in the browser and hosted on GitHub Pages**, which follows from "no live AI, free".
- **Singapore instead of the Gulf** for the migrant worker, because SAR/AED aren't in the top-10 list but SGD is.
- **Family support sent counts as an essential**, not a want.
- **The five measures, their weights and anchor points** in section 5.4.
- **Credit card payments count as debt payments**, unless the visitor marks them as a transfer because the card's purchases are also in the file.
- **Cash withdrawals count as spending.** Cash is assumed spent, and the cash-out charge is a fee.
- **Unrecognised money in counts as income, but is flagged** so the visitor can correct it. Loans received, cash deposits and savings withdrawals are never income.
- **The 7-day rule for complete months**, with the months used always shown on screen.
- **"Habits, not income"** is the message of the sample set, rather than "the healthiest person has the lowest income", which wouldn't be true in BDT.
- **No automatic language detection**, so English stays the default.
- **No live exchange rates**, using a dated snapshot instead.
- **Nothing is stored** about uploaded data, not even on the visitor's device.
- **MIT licence.**
- **Installable as an app (PWA) with offline support**, to cover "every device".
