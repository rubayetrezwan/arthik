import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { convert } from '../domain/currency'
import type { Measures } from '../domain/measures'
import { BAND_RANGES, bandOf, type ScoreResult } from '../domain/score'
import type { Dataset } from '../domain/types'
import { simulate, sliderLimits } from '../domain/whatif'
import { currencyDecimals, formatMoney, formatNumber, formatPercent } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { LOCALES } from '../i18n/locales'
import { usePrefs } from '../state/prefs'
import styles from './WhatIf.module.css'

interface WhatIfProps {
  dataset: Dataset
  measures: Measures
  /** The score as it is. The sliders show only when there is one (R14). */
  result: ScoreResult
}

/** Wants can be cut by 0 to 50%, 5% at a time (spec 5.7). */
const WANTS_STEP = 5
const WANTS_POSITIONS = 10

/** A money slider has between 20 and 50 steps, each 1, 2 or 5 times a power of ten. */
const FEWEST_STEPS = 20
const NICE_STEPS = [5, 2, 1] as const

/** The result is read out this long after the last change, so it is said once, not every step. */
const ANNOUNCE_AFTER_MS = 400

/** Where each slider is, counted in its own steps. All at 0 is no change. */
interface Positions {
  wants: number
  income: number
  savings: number
}

const AT_REST: Positions = Object.freeze({ wants: 0, income: 0, savings: 0 })

interface Scale {
  /** One step, in the display currency. */
  step: number
  /** How many steps the slider has. 0 turns it off. */
  positions: number
  /** The amount at a position, cleared of float noise at the currency's decimals. */
  at(position: number): number
}

/**
 * A money slider's steps, in the display currency, for amounts up to `max`: the largest
 * step that is 1, 2 or 5 times a power of ten and still gives at least 20 steps. That is
 * never more than 50, because each nice step is at most 2.5 times the next. The top is a
 * whole number of steps, so it rounds down. A step is never smaller than the currency
 * shows, so a very small `max` gets fewer steps, and one under that gets none.
 */
function moneyScale(max: number, decimals: number): Scale {
  const smallest = 1 / 10 ** decimals
  const scale = (step: number, positions: number): Scale => ({
    step,
    positions,
    at: (position) => Math.round(position * step * 10 ** decimals) / 10 ** decimals,
  })
  if (!(max >= smallest)) return scale(smallest, 0)

  for (let power = Math.floor(Math.log10(max / FEWEST_STEPS)); ; power -= 1) {
    for (const nice of NICE_STEPS) {
      const step = power >= 0 ? nice * 10 ** power : nice / 10 ** -power
      if (step < smallest) return scale(smallest, Math.floor(max / smallest))
      const positions = Math.floor(max / step)
      if (positions >= FEWEST_STEPS) return scale(step, positions)
    }
  }
}

/**
 * The position a key moves a slider to, or null for a key a slider does not use. Left and
 * right follow the reading direction, as the thumb does: in Arabic the low end is on the
 * right. Handled here, not left to the browser, so every browser steps the same way.
 */
function keyedPosition(key: string, position: number, positions: number, rtl: boolean) {
  const page = Math.max(1, Math.round(positions / 10))
  const forward = rtl ? -1 : 1
  const moves: Record<string, number> = {
    ArrowRight: position + forward,
    ArrowLeft: position - forward,
    ArrowUp: position + 1,
    ArrowDown: position - 1,
    PageUp: position + page,
    PageDown: position - page,
    Home: 0,
    End: positions,
  }
  const next = moves[key]
  return next === undefined ? null : Math.min(positions, Math.max(0, next))
}

/** `value`, but only once it has stayed the same for `delay` milliseconds. */
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

interface SliderProps {
  label: string
  position: number
  scale: Scale
  format(value: number): string
  onMove(position: number): void
  /** Why the slider is off. It is off when this is given or when it has no steps. */
  offNote?: ReactNode
  /** Said when the slider has no steps, so a switched-off slider is never unexplained. */
  noStepsNote?: ReactNode
}

function Slider({ label, position, scale, format, onMove, offNote, noStepsNote }: SliderProps) {
  const id = useId()
  const noteId = useId()
  const rtl = LOCALES[useLocale()].dir === 'rtl'
  const value = scale.at(position)
  const top = scale.at(scale.positions)
  const note = offNote ?? (scale.positions === 0 ? noStepsNote : undefined)

  return (
    <div className={styles.slider}>
      <div className={styles.head}>
        <label htmlFor={id}>{label}</label>
        {/* The value is spoken from aria-valuetext; this is for the eye. */}
        <span className={styles.value} aria-hidden="true">
          {format(value)}
        </span>
      </div>
      <input
        id={id}
        className={styles.range}
        type="range"
        min={0}
        max={top}
        step={scale.step}
        value={value}
        aria-valuetext={format(value)}
        aria-describedby={note ? noteId : undefined}
        disabled={offNote !== undefined || scale.positions === 0}
        onChange={(event) =>
          onMove(Math.min(scale.positions, Math.round(Number(event.target.value) / scale.step)))
        }
        onKeyDown={(event) => {
          const next = keyedPosition(event.key, position, scale.positions, rtl)
          if (next === null) return
          event.preventDefault()
          onMove(next)
        }}
      />
      <div className={styles.ends} aria-hidden="true">
        <span>{format(0)}</span>
        <span>{format(top)}</span>
      </div>
      {note && (
        <p id={noteId} className={styles.offNote}>
          {note}
        </p>
      )}
    </div>
  )
}

/**
 * "What if": three sliders that score a changed copy of the data and show how the score
 * would move. The data itself is never changed. The money sliders work in the display
 * currency and are simulated in taka. A new person, file, language or currency puts every
 * slider back to no change (Review Focus 5).
 */
export function WhatIf({ dataset, measures, result }: WhatIfProps) {
  const intl = useIntl()
  const locale = useLocale()
  const { currency } = usePrefs()
  const titleId = useId()

  // `moves` counts the visitor's slider changes. Only a change to a slider is read out.
  const [{ basis, positions: moved, moves }, setState] = useState(() => ({
    basis: { dataset, currency, locale },
    positions: AT_REST,
    moves: 0,
  }))
  const changedBasis =
    basis.dataset !== dataset || basis.currency !== currency || basis.locale !== locale
  if (changedBasis) setState({ basis: { dataset, currency, locale }, positions: AT_REST, moves: 0 })
  const positions = changedBasis ? AT_REST : moved
  const move = (slider: keyof Positions) => (position: number) =>
    setState((state) => ({
      ...state,
      positions: { ...state.positions, [slider]: position },
      moves: state.moves + 1,
    }))

  const limits = useMemo(() => sliderLimits(measures), [measures])
  const decimals = currencyDecimals(currency)
  const wantsScale: Scale = {
    step: WANTS_STEP,
    positions: WANTS_POSITIONS,
    at: (position) => position * WANTS_STEP,
  }
  const incomeScale = moneyScale(convert(limits.extraIncomeMaxBDT, 'BDT', currency), decimals)
  const savingsScale = moneyScale(convert(limits.addSavingsMaxBDT, 'BDT', currency), decimals)
  // Without savings entered there is nothing to add to, and adding would only re-weight (R14).
  const canAddSavings = dataset.emergencySavings !== null

  const cutWantsPct = wantsScale.at(positions.wants)
  const extraIncomeMonthlyBDT = convert(incomeScale.at(positions.income), currency, 'BDT')
  const addSavingsBDT = canAddSavings
    ? convert(savingsScale.at(positions.savings), currency, 'BDT')
    : 0
  const simulated = useMemo(
    () =>
      cutWantsPct === 0 && extraIncomeMonthlyBDT === 0 && addSavingsBDT === 0
        ? result
        : simulate(dataset, { cutWantsPct, extraIncomeMonthlyBDT, addSavingsBDT }).result,
    [dataset, result, cutWantsPct, extraIncomeMonthlyBDT, addSavingsBDT],
  )

  const from = result.score ?? 0
  const to = simulated.score ?? from
  const delta = to - from
  const shown = { from: formatNumber(from, locale), to: formatNumber(to, locale) }
  const sentence =
    delta === 0
      ? intl.formatMessage({ id: 'whatif.announce.same' }, { score: shown.from })
      : intl.formatMessage(
          { id: delta > 0 ? 'whatif.announce.up' : 'whatif.announce.down' },
          { ...shown, points: Math.abs(delta) },
        )
  // A new sentence is spoken only once a slider has moved and settled. A category change
  // that moves the score, with the sliders untouched, is not announced here.
  // (Settled as one text, since an object made on each render would never settle.)
  const settled = useSettled(`${changedBasis ? 0 : moves}|${sentence}`, ANNOUNCE_AFTER_MS)
  const settledMoves = Number(settled.slice(0, settled.indexOf('|')))
  const [spoken, setSpoken] = useState({ text: '', moves: 0 })
  if (settledMoves !== spoken.moves) {
    setSpoken({
      text: settledMoves === 0 ? '' : settled.slice(settled.indexOf('|') + 1),
      moves: settledMoves,
    })
  }

  if (result.status !== 'scored' || result.score === null || result.band === null) return null

  const money = (amount: number) => formatMoney(amount, currency, locale)
  const band = (id: string) => intl.formatMessage({ id: `band.${id}` })
  const toBand = bandOf(to)
  const next = BAND_RANGES[BAND_RANGES.findIndex((range) => range.band === toBand) + 1]

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <FormattedMessage id="whatif.title" />
      </h3>
      <p className={styles.note}>
        <FormattedMessage id="whatif.note" />
      </p>

      <div className={styles.layout}>
        <div>
          <Slider
            label={intl.formatMessage({ id: 'whatif.wants' })}
            position={positions.wants}
            scale={wantsScale}
            format={(pct) => formatPercent(pct / 100, locale)}
            onMove={move('wants')}
          />
          <Slider
            label={intl.formatMessage({ id: 'whatif.income' })}
            position={positions.income}
            scale={incomeScale}
            format={money}
            onMove={move('income')}
            noStepsNote={<FormattedMessage id="shell.stepsNone" />}
          />
          <Slider
            label={intl.formatMessage({ id: 'whatif.savings' })}
            position={canAddSavings ? positions.savings : 0}
            scale={savingsScale}
            format={money}
            onMove={move('savings')}
            offNote={canAddSavings ? undefined : <FormattedMessage id="whatif.savings.off" />}
            noStepsNote={<FormattedMessage id="shell.stepsNone" />}
          />
        </div>

        <div className={styles.result}>
          {/* Shown to the eye; screen readers hear the sentence below instead. */}
          <p className={styles.fromTo} aria-hidden="true">
            <span className={styles.from} data-testid="whatif-from">
              {shown.from}
            </span>{' '}
            <span className={styles.arrow}>→</span>{' '}
            <span data-testid="whatif-to">{shown.to}</span>
          </p>
          <p
            className={`${styles.delta} ${delta > 0 ? styles.up : delta < 0 ? styles.down : ''}`}
            aria-hidden="true"
          >
            <bdi>
              {delta === 0 ? (
                <FormattedMessage id="whatif.delta.same" />
              ) : (
                <FormattedMessage
                  id={delta > 0 ? 'whatif.delta.up' : 'whatif.delta.down'}
                  values={{ points: Math.abs(delta) }}
                />
              )}
            </bdi>
          </p>
          <p className="visually-hidden" aria-live="polite">
            {spoken.text}
          </p>
          <p className={styles.band}>
            {toBand !== result.band ? (
              <FormattedMessage id="whatif.band.moved" values={{ band: band(toBand) }} />
            ) : next ? (
              <FormattedMessage
                id="whatif.band.still"
                values={{
                  band: band(toBand),
                  next: band(next.band),
                  min: formatNumber(next.min, locale),
                }}
              />
            ) : (
              <FormattedMessage id="whatif.band.top" values={{ band: band(toBand) }} />
            )}
          </p>
        </div>
      </div>
    </section>
  )
}
