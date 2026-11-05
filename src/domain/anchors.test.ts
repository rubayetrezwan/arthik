import { describe, expect, it } from 'vitest'
import { ANCHORS, CAN_BE_NEGATIVE, interpolate, LOWEST_SCORE, type Anchor } from './anchors'
import { MEASURE_IDS } from './score'

describe('interpolate', () => {
  const line: readonly Anchor[] = [
    [0, 10],
    [10, 50],
    [20, 30],
  ]

  it('returns the anchor score exactly at an anchor point', () => {
    expect(interpolate(0, line)).toBe(10)
    expect(interpolate(10, line)).toBe(50)
    expect(interpolate(20, line)).toBe(30)
  })

  it('moves in a straight line between two anchors, rising or falling', () => {
    expect(interpolate(5, line)).toBe(30)
    expect(interpolate(15, line)).toBe(40)
  })

  it('is not pushed off a .5 by floating-point error', () => {
    // 0.33 on the debt line is exactly 37.5, but plain float arithmetic gives
    // 37.49999999999999, which would round down to 37 instead of up to 38.
    expect(interpolate(0.33, ANCHORS.debtPayments)).toBe(37.5)
    expect(Math.round(interpolate(0.33, ANCHORS.debtPayments))).toBe(38)
  })

  it('stays at the first and last score outside the anchors', () => {
    expect(interpolate(-100, line)).toBe(10)
    expect(interpolate(100, line)).toBe(30)
  })
})

describe('ANCHORS', () => {
  it('has x strictly ascending and scores within 0 to 100 for every measure', () => {
    for (const id of MEASURE_IDS) {
      const anchors = ANCHORS[id]
      expect(anchors.length).toBeGreaterThanOrEqual(2)
      for (const [index, [x, score]] of anchors.entries()) {
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
        const previous = anchors[index - 1]
        if (previous) expect(x).toBeGreaterThan(previous[0])
      }
    }
  })

  it('scores the savings rate: -10% is 0, 0% is 30, 10% is 70, 20% and up is 100', () => {
    expect(interpolate(0.05, ANCHORS.savingsRate)).toBe(50)
    expect(interpolate(-0.2, ANCHORS.savingsRate)).toBe(0)
    expect(interpolate(0.25, ANCHORS.savingsRate)).toBe(100)
  })

  it('scores the emergency buffer: 0 is 0, 1 month is 40, 3 is 80, 6 and up is 100', () => {
    expect(interpolate(4.5, ANCHORS.emergencySavings)).toBe(90)
    expect(interpolate(6, ANCHORS.emergencySavings)).toBe(100)
    expect(interpolate(10, ANCHORS.emergencySavings)).toBe(100)
  })

  it('scores the debt load: 0% is 100, 10% is 90, 20% is 70, 36% is 30, 50% and up is 0', () => {
    expect(interpolate(0.36, ANCHORS.debtPayments)).toBe(30)
    expect(interpolate(0.43, ANCHORS.debtPayments)).toBe(15)
    expect(interpolate(0.6, ANCHORS.debtPayments)).toBe(0)
  })

  it('scores needs vs. wants: 20% and under is 100, 30% is 80, 40% is 50, 60% and up is 0', () => {
    expect(interpolate(0.2, ANCHORS.needsWants)).toBe(100)
    expect(interpolate(0.5, ANCHORS.needsWants)).toBe(25)
  })

  it('scores spending stability: 0.10 and under is 100, 0.25 is 60, 0.50 and up is 0', () => {
    expect(interpolate(0.1, ANCHORS.stability)).toBe(100)
    expect(interpolate(0.375, ANCHORS.stability)).toBe(30)
  })
})

describe('LOWEST_SCORE and CAN_BE_NEGATIVE', () => {
  it('LOWEST_SCORE is the lowest score any anchor gives', () => {
    const lowest = Math.min(...MEASURE_IDS.flatMap((id) => ANCHORS[id].map(([, score]) => score)))
    expect(LOWEST_SCORE).toBe(lowest)
    expect(LOWEST_SCORE).toBe(0)
  })

  it('CAN_BE_NEGATIVE is exactly the measures whose first anchor is below zero', () => {
    const negative = MEASURE_IDS.filter((id) => (ANCHORS[id][0]?.[0] ?? 0) < 0)
    expect([...CAN_BE_NEGATIVE].sort()).toEqual([...negative].sort())
    expect([...CAN_BE_NEGATIVE]).toEqual(['savingsRate'])
  })
})
