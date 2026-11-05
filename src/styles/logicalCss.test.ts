/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Logical CSS only (conventions): nothing may name left, right, top or bottom, or set
// the two sides of a margin or padding with a 3- or 4-value shorthand, which hides a
// physical side. One- and two-value shorthands are the same in every writing direction.
// Read from disk: the test runner turns a stylesheet import into an object, not its text.
const SRC = join(__dirname, '..')

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? cssFiles(join(dir, entry.name))
      : entry.name.endsWith('.css')
        ? [join(dir, entry.name)]
        : [],
  )
}

const files = Object.fromEntries(cssFiles(SRC).map((file) => [file, readFileSync(file, 'utf8')]))

/** The CSS with comments removed, as [file, line number, text] for every declaration line. */
function declarations(): { file: string; line: number; text: string }[] {
  return Object.entries(files).flatMap(([file, css]) =>
    css
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '))
      .split('\n')
      .map((text, index) => ({ file, line: index + 1, text: text.trim() }))
      .filter(({ text }) => text.length > 0),
  )
}

describe('logical CSS', () => {
  it('finds the stylesheets', () => {
    expect(Object.keys(files).length).toBeGreaterThan(10)
  })

  it('uses no physical margin, padding, border, inset, float or text-align property', () => {
    const physical =
      /^(?:(?:margin|padding)-(?:left|right|top|bottom)|border-(?:left|right|top|bottom)(?:-[a-z]+)?|(?:left|right|top|bottom)|float|clear)\s*:|^text-align\s*:\s*(?:left|right)\b/
    const found = declarations().filter(({ text }) => physical.test(text))
    expect(found.map(({ file, line, text }) => `${file}:${line} ${text}`)).toEqual([])
  })

  it('has no 3- or 4-value margin or padding shorthand', () => {
    const shorthand = /^(margin|padding)\s*:\s*([^;]+);/
    const found = declarations().filter(({ text }) => {
      const value = shorthand.exec(text)?.[2]
      if (!value) return false
      // Count the space-separated values outside any parentheses.
      const flat = value.replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '()')
      return flat.trim().split(/\s+/).length >= 3
    })
    expect(found.map(({ file, line, text }) => `${file}:${line} ${text}`)).toEqual([])
  })
})
