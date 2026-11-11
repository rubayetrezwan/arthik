import { useId } from 'react'
import { FormattedMessage } from 'react-intl'
import { CSV_EXAMPLES } from './csvExamples'
import styles from './CsvFormatHelp.module.css'

/** A column name or an example as the file has to write it: never translated. */
const code = (text: string) => <code>{text}</code>

/**
 * What a CSV file needs: the columns, the date and amount forms the reader takes, the credit
 * card rule that keeps spending from being counted twice (spec 5.3), and the template.
 */
export function CsvFormatHelp() {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={styles.help}>
      <h2 id={titleId} className={styles.title}>
        <FormattedMessage id="upload.help.title" />
      </h2>
      <p className={styles.note}>
        <FormattedMessage id="upload.help.intro" />
      </p>

      <h3 className={styles.subtitle}>
        <FormattedMessage id="upload.help.columns" />
      </h3>
      <dl className={styles.columns}>
        <dt>{code('date')}</dt>
        <dd>
          <FormattedMessage
            id="upload.help.date"
            values={{
              iso: code(CSV_EXAMPLES.isoDate),
              dayFirst: code(CSV_EXAMPLES.dayFirstDate),
              named: code(CSV_EXAMPLES.namedMonthDate),
            }}
          />
        </dd>
        <dt>{code('description')}</dt>
        <dd>
          <FormattedMessage id="upload.help.description" />
        </dd>
        <dt>{code('amount')}</dt>
        <dd>
          <p>
            <FormattedMessage
              id="upload.help.amount"
              values={{
                moneyIn: code(CSV_EXAMPLES.moneyIn),
                moneyOut: code(CSV_EXAMPLES.moneyOut),
              }}
            />
          </p>
          <p>
            <FormattedMessage
              id="upload.help.debitCredit"
              values={{
                amount: code('amount'),
                debit: code('debit'),
                credit: code('credit'),
                withdrawal: code('withdrawal'),
                deposit: code('deposit'),
              }}
            />
          </p>
        </dd>
        <dt>{code('currency')}</dt>
        <dd>
          <FormattedMessage
            id="upload.help.currency"
            values={{ example: code(CSV_EXAMPLES.currency) }}
          />
        </dd>
        <dt>{code('category')}</dt>
        <dd>
          <FormattedMessage id="upload.help.category" />
        </dd>
      </dl>
      <p className={styles.after}>
        <FormattedMessage
          id="upload.help.aliases"
          values={{
            transactionDate: code('Transaction Date'),
            valueDate: code('Value Date'),
            narration: code('Narration'),
            particulars: code('Particulars'),
            withdrawalAmount: code('Withdrawal Amount'),
            depositAmount: code('Deposit Amount'),
          }}
        />
      </p>

      <h3 className={styles.subtitle}>
        <FormattedMessage id="upload.help.creditCard.title" />
      </h3>
      <p>
        <FormattedMessage id="upload.help.creditCard" />
      </p>
      <p className={styles.after}>
        <FormattedMessage id="upload.help.accounts" />
      </p>

      <p className={styles.note}>
        <FormattedMessage id="upload.help.template.note" />
      </p>
    </section>
  )
}
