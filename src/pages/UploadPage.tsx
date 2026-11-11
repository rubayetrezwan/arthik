import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FormattedMessage } from 'react-intl'
import { useNavigate } from 'react-router'
import { CsvErrors } from '../components/CsvErrors'
import { CsvFormatHelp } from '../components/CsvFormatHelp'
import { GetYourFile } from '../components/GetYourFile'
import { checkFile, FileDrop, type FileProblem } from '../components/FileDrop'
import { PageHead } from '../components/PageHead'
import { readSavings, SavingsField, type SavingsReading } from '../components/SavingsField'
import { parseTransactionsCsv, type ParseResult } from '../domain/csv'
import type { CurrencyCode, Transaction } from '../domain/types'
import { usePrefs } from '../state/prefs'
import { useSession } from '../state/session'
import styles from './UploadPage.module.css'

const TEMPLATE_URL = `${import.meta.env.BASE_URL}arthik-template.csv`

/** A file that was read and has problems, kept until the visitor fixes it or goes on. */
interface Checked {
  /** The file's text, held in memory only, to read again if the currency changes. */
  text: string
  /** The currency rows without one were given. */
  currency: CurrencyCode
  result: ParseResult
}

/**
 * The visitor's own file: chosen or dropped, checked for size, read in the browser and parsed.
 * A clean file goes straight to its score; one with problems lists them and offers to go on with
 * the rows that could be read. Nothing is stored: the file and its rows live in memory.
 */
export function UploadPage() {
  const { currency } = usePrefs()
  const { setUpload } = useSession()
  const navigate = useNavigate()

  const [file, setFile] = useState<File | null>(null)
  const [fileProblem, setFileProblem] = useState<FileProblem | null>(null)
  const [savingsText, setSavingsText] = useState('')
  const [savingsInvalid, setSavingsInvalid] = useState(false)
  const [checked, setChecked] = useState<Checked | null>(null)
  const [reading, setReading] = useState(false)
  const [exampleFailed, setExampleFailed] = useState(false)

  const fileInput = useRef<HTMLInputElement>(null)
  const savingsInput = useRef<HTMLInputElement>(null)
  const summary = useRef<HTMLElement>(null)
  // The file chosen now, for a read that finishes after the visitor has chosen another.
  const chosenFile = useRef<File | null>(null)

  // The list of problems takes the focus each time a file shows some.
  useEffect(() => {
    if (checked) summary.current?.focus()
  }, [checked])

  function choose(chosen: File) {
    const problem = checkFile(chosen)
    setChecked(null)
    setFileProblem(problem)
    setFile(problem ? null : chosen)
    chosenFile.current = problem ? null : chosen
  }

  /** The savings as typed, or null after pointing the visitor at them when they cannot be read. */
  function savingsOrStop(): SavingsReading | null {
    const savings = readSavings(savingsText)
    setSavingsInvalid(savings.kind === 'invalid')
    if (savings.kind !== 'invalid') return savings
    savingsInput.current?.focus()
    return null
  }

  function finish(transactions: Transaction[], savings: SavingsReading) {
    setUpload({
      key: 'mine',
      transactions,
      // In the display currency, as the field says.
      emergencySavings: savings.kind === 'amount' ? { amount: savings.amount, currency } : null,
    })
    navigate('/score/mine')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (reading) return

    const savings = readSavings(savingsText)
    setSavingsInvalid(savings.kind === 'invalid')
    if (!file) {
      // A file refused when it was chosen keeps its own reason.
      setFileProblem((problem) => problem ?? { kind: 'missing' })
      fileInput.current?.focus()
      return
    }
    if (savings.kind === 'invalid') {
      savingsInput.current?.focus()
      return
    }

    setReading(true)
    let text: string
    try {
      text = await file.text()
    } catch {
      setReading(false)
      if (chosenFile.current !== file) return
      setFile(null)
      chosenFile.current = null
      setFileProblem({ kind: 'unreadable', name: file.name })
      fileInput.current?.focus()
      return
    }
    setReading(false)
    // Another file was chosen while this one was read: what this one holds no longer counts.
    if (chosenFile.current !== file) return
    const result = parseTransactionsCsv(text, currency)

    if (result.errors.length > 0) {
      setChecked({ text, currency, result })
    } else if (result.transactions.length === 0) {
      // Every row was skipped for moving no money.
      setFile(null)
      chosenFile.current = null
      setFileProblem({ kind: 'all_zero', name: file.name })
      fileInput.current?.focus()
    } else {
      finish(result.transactions, savings)
    }
  }

  /** The example file: the template, fetched from this site and read like a file the visitor chose. */
  async function tryExample() {
    if (reading) return
    const savings = savingsOrStop()
    if (!savings) return
    setReading(true)
    setExampleFailed(false)
    let text: string
    try {
      const response = await fetch(TEMPLATE_URL)
      if (!response.ok) throw new Error(String(response.status))
      text = await response.text()
    } catch {
      setReading(false)
      setExampleFailed(true)
      return
    }
    setReading(false)
    const result = parseTransactionsCsv(text, currency)
    if (result.errors.length > 0 || result.transactions.length === 0) {
      setExampleFailed(true)
      return
    }
    finish(result.transactions, savings)
  }

  function continueWithValidRows() {
    if (!checked) return
    const savings = savingsOrStop()
    if (!savings) return
    // Rows without a currency take the one chosen now, which the visitor may have changed
    // since the file was read. The rows that can be read are the same either way.
    const { transactions } =
      checked.currency === currency ? checked.result : parseTransactionsCsv(checked.text, currency)
    finish(transactions, savings)
  }

  return (
    <>
      <PageHead title={<FormattedMessage id="upload.title" />}>
        <p>
          <FormattedMessage id="upload.lead" />
        </p>
        <p className={styles.privacy}>
          <strong>
            <FormattedMessage id="upload.privacy.lead" />
          </strong>{' '}
          <FormattedMessage id="upload.privacy.text" />{' '}
          <FormattedMessage id="upload.privacy.check" />
        </p>
      </PageHead>

      <div className={styles.columns}>
        <form className={styles.form} noValidate onSubmit={submit}>
          <GetYourFile />
          <FileDrop file={file} problem={fileProblem} onChoose={choose} inputRef={fileInput} />
          <p className={styles.fileTools}>
            <a href={TEMPLATE_URL} download className={styles.templateLink}>
              <FormattedMessage id="upload.where.template" />
            </a>
          </p>
          <SavingsField
            value={savingsText}
            onChange={(text) => {
              setSavingsText(text)
              setSavingsInvalid(false)
            }}
            invalid={savingsInvalid}
            currency={currency}
            inputRef={savingsInput}
          />
          <button type="submit" className={styles.submit} aria-disabled={reading || undefined}>
            <FormattedMessage id={reading ? 'upload.reading' : 'upload.submit'} />
          </button>

          <button
            type="button"
            className={styles.example}
            aria-disabled={reading || undefined}
            onClick={tryExample}
          >
            <FormattedMessage id="upload.where.example" />
          </button>
          {exampleFailed && (
            <p role="alert" className={styles.exampleFailed}>
              <FormattedMessage id="upload.where.exampleFailed" />
            </p>
          )}

          {checked && (
            <CsvErrors
              errors={checked.result.errors}
              validCount={checked.result.transactions.length}
              onContinue={continueWithValidRows}
              summaryRef={summary}
            />
          )}
        </form>

        <CsvFormatHelp />
      </div>
    </>
  )
}
