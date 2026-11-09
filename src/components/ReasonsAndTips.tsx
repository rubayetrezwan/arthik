import { useId, useMemo, type ReactNode } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { ANCHORS } from '../domain/anchors'
import type { Measures } from '../domain/measures'
import { STRENGTH_FROM, topReasons, type Reason } from '../domain/reasons'
import { HIGHEST_SCORE, type MeasureId, type ScoreResult } from '../domain/score'
import { DPS_TARGET_MONTHS, pickTips, TIP_MEASURE, type Tip } from '../domain/tips'
import type { Dataset } from '../domain/types'
import { useMoney } from '../hooks/useMoney'
import { formatMonth, formatNumber, formatPercent } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import { MonthsMessage, savingsRateForm, ShareMessage } from './FigureMessage'
import styles from './ReasonsAndTips.module.css'

interface ReasonsAndTipsProps {
  dataset: Dataset
  measures: Measures
  /** Shown only when scored (R14): reasons and tips explain a score, so there must be one. */
  result: ScoreResult
}

/** The value of a measure that earns `score`, read from its anchor points (spec 5.4). */
function valueScoring(id: MeasureId, score: number): number {
  const anchor = ANCHORS[id].find(([, earns]) => earns === score)
  if (!anchor) throw new Error(`No anchor of ${id} scores ${score}`)
  return anchor[0]
}

/** The score at which debt payments are first worth naming: one step down from none at all. */
const DEBT_BENCHMARK_SCORE = 90
/** Emergency savings reach the healthy band at this score. */
const SAVINGS_BENCHMARK_SCORE = 80

/** A reason: the person's own number, then the benchmark that scores well. */
function ReasonText({ measure, dataset, measures }: { measure: MeasureId; dataset: Dataset; measures: Measures }) {
  const locale = useLocale()
  const money = useMoney()
  const months = measures.months.length
  const max = formatNumber(HIGHEST_SCORE, locale)
  const percent = (ratio: number) => formatPercent(ratio, locale)

  switch (measure) {
    case 'savingsRate': {
      const rate = measures.savingsRate ?? 0
      const form = savingsRateForm(rate)
      const kept = (measures.income - measures.spending - measures.debtPayments) / months
      return (
        <FormattedMessage
          id={`reason.savingsRate.${form}`}
          values={{
            amount: money(Math.abs(kept)),
            share: percent(Math.abs(rate)),
            target: percent(valueScoring('savingsRate', HIGHEST_SCORE)),
            max,
          }}
        />
      )
    }
    case 'emergencySavings': {
      const benchmark = {
        target: formatNumber(valueScoring('emergencySavings', SAVINGS_BENCHMARK_SCORE), locale),
        targetScore: formatNumber(SAVINGS_BENCHMARK_SCORE, locale),
        full: formatNumber(valueScoring('emergencySavings', HIGHEST_SCORE), locale),
        max,
      }
      const savings = dataset.emergencySavings
      const covered = measures.bufferMonths ?? 0
      if (!savings || covered === 0) {
        return <FormattedMessage id="reason.emergencySavings.none" values={benchmark} />
      }
      return (
        <MonthsMessage
          id="reason.emergencySavings"
          months={covered}
          values={{ ...benchmark, amount: money(savings.amount, savings.currency) }}
        />
      )
    }
    case 'debtPayments': {
      const ratio = measures.debtRatio ?? 0
      if (ratio === 0) return <FormattedMessage id="reason.debtPayments.none" values={{ max }} />
      return (
        <ShareMessage
          id="reason.debtPayments"
          share={ratio}
          values={{
            amount: money(measures.debtPayments / months),
            limit: percent(valueScoring('debtPayments', DEBT_BENCHMARK_SCORE)),
            limitScore: formatNumber(DEBT_BENCHMARK_SCORE, locale),
            max,
          }}
        />
      )
    }
    case 'needsWants':
      return (
        <ShareMessage
          id="reason.needsWants"
          share={measures.wantsShare ?? 0}
          values={{ target: percent(valueScoring('needsWants', HIGHEST_SCORE)), max }}
        />
      )
    case 'stability':
      return (
        <ShareMessage
          id="reason.stability"
          share={measures.spendingCV ?? 0}
          values={{ target: percent(valueScoring('stability', HIGHEST_SCORE)), max }}
        />
      )
  }
}

/** A tip, with its numbers filled in. Money in the tips is in taka, shown in the display currency. */
function TipText({ tip }: { tip: Tip }) {
  const intl = useIntl()
  const locale = useLocale()
  const money = useMoney()
  const number = (key: string) => Number(tip.values[key])
  // In a sentence a name reads with "and", not "&": a category whose name has an ampersand
  // has a prose form beside it. Table and select labels keep the short form.
  const category = (id: string) => {
    const prose = `category.${id}.prose`
    return intl.formatMessage({ id: prose in intl.messages ? prose : `category.${id}` })
  }

  const values: Record<string, ReactNode> = (() => {
    switch (tip.id) {
      case 'start_dps':
        return {
          amount: money(number('monthly')),
          target: formatNumber(DPS_TARGET_MONTHS, locale),
          months: number('months'),
        }
      case 'cut_biggest_want':
        return { category: category(String(tip.values.category)), amount: money(number('amount')) }
      case 'save_on_payday':
        return { amount: money(number('amount')), target: formatPercent(number('target'), locale) }
      case 'avoid_cash_fees':
        return { category: category('fees'), amount: money(number('amount')) }
      case 'steady_spending':
        return { month: formatMonth(String(tip.values.month), locale) }
      case 'sort_uncategorised':
        // Offered from 10% of spending, so it never rounds to 0%.
        return { share: formatPercent(number('pct'), locale) }
      case 'check_unrecognised':
        return { count: number('count') }
      case 'debt_highest_interest':
      case 'keep_going':
        return {}
    }
  })()

  return <FormattedMessage id={`tip.${tip.id}`} values={values} />
}

function ReasonItem({
  reason,
  score,
  tips,
  dataset,
  measures,
}: {
  reason: Reason
  score: number | null
  tips: Tip[]
  dataset: Dataset
  measures: Measures
}) {
  const locale = useLocale()

  return (
    <li className={styles.reason}>
      <div>
        <h4 className={styles.measure}>
          <FormattedMessage id={`measure.${reason.measure}.name`} />
        </h4>
        <p>
          <ReasonText measure={reason.measure} dataset={dataset} measures={measures} />
        </p>
        <p className={styles.worth}>
          {reason.kind === 'improve' ? (
            <FormattedMessage
              id="reasons.worth"
              values={{ points: reason.pointsAvailableHundredths / 100 }}
            />
          ) : (
            <FormattedMessage
              id="reasons.scores"
              values={{
                score: formatNumber(score ?? 0, locale),
                max: formatNumber(HIGHEST_SCORE, locale),
              }}
            />
          )}
        </p>
      </div>
      {tips.length > 0 && (
        <div className={styles.help}>
          <p className={styles.label}>
            <FormattedMessage id="reasons.help" />
          </p>
          {tips.map((tip) => (
            <p key={tip.id}>
              <TipText tip={tip} />
            </p>
          ))}
        </div>
      )}
    </li>
  )
}

/**
 * Why the score is what it is: the measures with the most to gain, each beside the tip that
 * answers it, then any tip that answers no one measure. When every measure does well, the
 * strongest are named instead.
 */
export function ReasonsAndTips({ dataset, measures, result }: ReasonsAndTipsProps) {
  const locale = useLocale()
  const titleId = useId()
  const moreId = useId()
  const reasons = useMemo(() => topReasons(result), [result])
  const tips = useMemo(() => pickTips(dataset, measures, result), [dataset, measures, result])

  if (result.status !== 'scored' || result.score === null) return null

  const strengths = reasons.every((reason) => reason.kind === 'strength')
  const tipsFor = (measure: MeasureId) => tips.filter((tip) => TIP_MEASURE[tip.id] === measure)
  const others = tips.filter(
    (tip) => !reasons.some((reason) => TIP_MEASURE[tip.id] === reason.measure),
  )
  const score = formatNumber(result.score, locale)

  return (
    <section aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <FormattedMessage
          id={strengths ? 'reasons.title.strengths' : 'reasons.title'}
          values={{ score }}
        />
      </h3>
      <p className={styles.note}>
        <FormattedMessage
          id={strengths ? 'reasons.note.strengths' : 'reasons.note'}
          values={{
            min: formatNumber(STRENGTH_FROM, locale),
            max: formatNumber(HIGHEST_SCORE, locale),
          }}
        />
      </p>

      <ol className={styles.reasons} aria-labelledby={titleId}>
        {reasons.map((reason) => (
          <ReasonItem
            key={reason.measure}
            reason={reason}
            score={result.lines.find((line) => line.id === reason.measure)?.subScore ?? null}
            tips={tipsFor(reason.measure)}
            dataset={dataset}
            measures={measures}
          />
        ))}
      </ol>

      {others.length > 0 && (
        <div className={styles.more}>
          <p id={moreId} className={styles.label}>
            <FormattedMessage
              id={others.length < tips.length ? 'reasons.more' : 'reasons.help'}
            />
          </p>
          <ul aria-labelledby={moreId}>
            {others.map((tip) => (
              <li key={tip.id}>
                <TipText tip={tip} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
