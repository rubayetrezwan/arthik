// Refreshes src/data/rates.json from ExchangeRate-API's free open endpoint.
// Run with `npm run rates:update`. This is the only place the project touches
// the network; the site itself ships the snapshot and makes no live calls.

import { writeFile } from 'node:fs/promises'

const API_URL = 'https://open.er-api.com/v6/latest/BDT'
const OUTPUT_URL = new URL('../src/data/rates.json', import.meta.url)

// Same codes, same order as CURRENCY_CODES in src/domain/types.ts.
const CURRENCY_CODES = ['BDT', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD']

async function main() {
  const response = await fetch(API_URL)
  if (!response.ok) {
    throw new Error(`Rates request failed: HTTP ${response.status}`)
  }
  const payload = await response.json()
  if (payload.result !== 'success') {
    throw new Error(`Rates request was not successful: ${JSON.stringify(payload.result)}`)
  }

  const updatedAt = new Date(payload.time_last_update_utc)
  if (Number.isNaN(updatedAt.getTime())) {
    throw new Error(`Unreadable update time: ${JSON.stringify(payload.time_last_update_utc)}`)
  }

  const perBDT = {}
  for (const code of CURRENCY_CODES) {
    const rate = payload.rates?.[code]
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Missing or invalid rate for ${code}: ${String(rate)}`)
    }
    perBDT[code] = rate
  }

  const snapshot = {
    base: 'BDT',
    date: updatedAt.toISOString().slice(0, 10),
    source: 'ExchangeRate-API',
    sourceUrl: 'https://www.exchangerate-api.com',
    perBDT,
  }

  await writeFile(OUTPUT_URL, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`Wrote ${snapshot.date} rates for ${CURRENCY_CODES.length} currencies to src/data/rates.json`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
