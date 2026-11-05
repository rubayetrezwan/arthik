// Writes .dev/review/<locale>.html: English beside a translation, for a person to read.
// Run with `npm run translations:review -- bn`. The page is for the owner's eyes only and is
// not part of the site; it is written to .dev, which git ignores.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { isLocaleCode, LOCALES, type LocaleCode } from '../src/i18n/locales'

type Messages = Record<string, string>

/** Fonts that carry each script on a typical Windows, macOS or Linux machine. */
const FONTS: Record<LocaleCode, string> = {
  en: 'system-ui, "Segoe UI", sans-serif',
  bn: '"Nirmala UI", "Noto Sans Bengali", "Kohinoor Bangla", "Bangla Sangam MN", sans-serif',
  hi: '"Nirmala UI", "Noto Sans Devanagari", "Kohinoor Devanagari", "Devanagari Sangam MN", sans-serif',
  ar: '"Segoe UI", "Noto Naskh Arabic", "Geeza Pro", Tahoma, sans-serif',
  zh: '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Noto Sans CJK SC", sans-serif',
  es: 'system-ui, "Segoe UI", sans-serif',
  fr: 'system-ui, "Segoe UI", sans-serif',
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escapes the text and sets simple {placeholders} apart so a reviewer sees what is code. */
function render(text: string): string {
  return escapeHtml(text).replace(/\{(\w+)\}/g, '<code class="ph">{$1}</code>')
}

function read(path: URL): Messages {
  return JSON.parse(readFileSync(fileURLToPath(path), 'utf8')) as Messages
}

/** The part of a key before its first dot, which is the page or feature it belongs to. */
function prefixOf(key: string): string {
  const dot = key.indexOf('.')
  return dot === -1 ? key : key.slice(0, dot)
}

export function buildReview(code: LocaleCode, en: Messages, translation: Messages): string {
  const info = LOCALES[code]
  const groups = new Map<string, string[]>()
  for (const key of Object.keys(en)) {
    const prefix = prefixOf(key)
    groups.set(prefix, [...(groups.get(prefix) ?? []), key])
  }

  const missing = Object.keys(en).filter((key) => !(key in translation))
  const same = Object.keys(en).filter((key) => translation[key] === en[key])

  const sections = [...groups.entries()]
    .map(([prefix, keys]) => {
      const rows = keys
        .map((key) => {
          const text = translation[key]
          const cell =
            text === undefined
              ? '<span class="flag">missing</span>'
              : render(text) + (text === en[key] ? ' <span class="flag">same as English</span>' : '')
          return `<tr><th scope="row" class="key">${escapeHtml(key)}</th><td lang="en" dir="ltr">${render(en[key] ?? '')}</td><td class="tr" lang="${info.intl}" dir="${info.dir}">${cell}</td></tr>`
        })
        .join('\n')
      return `<section id="${escapeHtml(prefix)}">
<h2>${escapeHtml(prefix)} <span class="count">${keys.length}</span></h2>
<table>
<thead><tr><th scope="col">Key</th><th scope="col">English</th><th scope="col">${escapeHtml(info.nativeName)}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`
    })
    .join('\n')

  const nav = [...groups.entries()]
    .map(([prefix, keys]) => `<a href="#${escapeHtml(prefix)}">${escapeHtml(prefix)} (${keys.length})</a>`)
    .join(' ')

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Arthik translation review: ${escapeHtml(info.nativeName)}</title>
<style>
:root { --ink: #1b1b1b; --muted: #5d5d5d; --paper: #fbfaf7; --rule: #d9d6cf; --flag: #8a3b00; --code: #eceae3; }
@media (prefers-color-scheme: dark) {
  :root { --ink: #ece9e2; --muted: #a9a59b; --paper: #181816; --rule: #3a3935; --flag: #ffb77a; --code: #2a2926; }
}
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px 64px; background: var(--paper); color: var(--ink); font: 17px/1.55 system-ui, "Segoe UI", sans-serif; }
main { max-width: 1200px; margin: 0 auto; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 20px; margin: 40px 0 8px; }
.count { color: var(--muted); font-size: 15px; font-weight: 400; }
.summary { color: var(--muted); margin: 0 0 16px; }
nav { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 0 0 8px; font-size: 15px; }
a { color: inherit; }
#filter { width: 100%; max-width: 420px; padding: 8px 10px; font: inherit; color: inherit; background: transparent; border: 1px solid var(--rule); border-radius: 3px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { text-align: start; vertical-align: top; padding: 8px 10px; border-block-end: 1px solid var(--rule); overflow-wrap: anywhere; }
thead th { position: sticky; top: 0; background: var(--paper); font-size: 15px; color: var(--muted); border-block-end: 2px solid var(--rule); }
th.key { width: 22%; font: 13px/1.4 ui-monospace, "Cascadia Mono", Consolas, monospace; color: var(--muted); font-weight: 400; }
thead th:nth-child(1) { width: 22%; }
td { width: 39%; }
td.tr { font-family: var(--tr-font); font-size: 19px; line-height: 1.65; }
code.ph { background: var(--code); padding: 0 3px; border-radius: 2px; font: 14px ui-monospace, "Cascadia Mono", Consolas, monospace; direction: ltr; unicode-bidi: isolate; }
.flag { color: var(--flag); font-size: 14px; }
tr[hidden] { display: none; }
@media (max-width: 720px) { th.key, thead th:nth-child(1) { width: 18%; } }
</style>
</head>
<body style="--tr-font: ${FONTS[code]}">
<main>
<h1>Arthik translation review: ${escapeHtml(info.nativeName)} (${code})</h1>
<p class="summary">${Object.keys(en).length} messages. ${missing.length} missing. ${same.length} identical to English (brand names, code-only values and shared words are expected here). Placeholders such as <code class="ph">{amount}</code> are filled in by the app and must stay as they are.</p>
<p><input id="filter" type="search" placeholder="Filter by key or text" aria-label="Filter by key or text"></p>
<nav aria-label="Sections">${nav}</nav>
${sections}
</main>
<script>
const filter = document.getElementById('filter')
filter.addEventListener('input', () => {
  const needle = filter.value.trim().toLowerCase()
  for (const row of document.querySelectorAll('tbody tr')) {
    row.hidden = needle !== '' && !row.textContent.toLowerCase().includes(needle)
  }
})
</script>
</body>
</html>
`
}

function main() {
  const code = process.argv[2]
  if (!code || !isLocaleCode(code) || code === 'en') {
    console.error('Usage: npm run translations:review -- <bn|hi|ar|zh|es|fr>')
    process.exit(1)
  }

  const messages = new URL('../src/i18n/messages/', import.meta.url)
  let translation: Messages
  try {
    translation = read(new URL(`${code}.json`, messages))
  } catch {
    console.error(`src/i18n/messages/${code}.json does not exist yet`)
    process.exit(1)
  }

  const folder = new URL('../.dev/review/', import.meta.url)
  mkdirSync(fileURLToPath(folder), { recursive: true })
  const out = new URL(`${code}.html`, folder)
  writeFileSync(fileURLToPath(out), buildReview(code, read(new URL('en.json', messages)), translation))
  console.log(`Wrote ${fileURLToPath(out)}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
