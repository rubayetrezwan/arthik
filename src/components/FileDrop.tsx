import { useEffect, useId, useRef, useState, type DragEvent, type Ref } from 'react'
import { FormattedMessage } from 'react-intl'
import { formatNumber } from '../i18n/format'
import { useLocale } from '../i18n/I18nProvider'
import styles from './FileDrop.module.css'

/** The largest file the page reads, in megabytes. */
export const MAX_FILE_MB = 5
const BYTES_PER_MB = 1024 * 1024
const MAX_FILE_BYTES = MAX_FILE_MB * BYTES_PER_MB

/** Why the file chosen cannot be used, before or after reading it. */
export type FileProblem =
  | { kind: 'missing' }
  | { kind: 'not_csv'; name: string }
  | { kind: 'too_big'; name: string; bytes: number }
  | { kind: 'unreadable'; name: string }
  | { kind: 'all_zero'; name: string }

/** Whether a file can be read at all: a .csv file of up to `MAX_FILE_MB`. Checked before reading. */
export function checkFile(file: File): FileProblem | null {
  if (!/\.csv$/i.test(file.name)) return { kind: 'not_csv', name: file.name }
  if (file.size > MAX_FILE_BYTES) return { kind: 'too_big', name: file.name, bytes: file.size }
  return null
}

function hasFiles(event: { dataTransfer: DataTransfer | null }): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

interface FileDropProps {
  file: File | null
  problem: FileProblem | null
  onChoose(file: File): void
  inputRef: Ref<HTMLInputElement>
}

/**
 * The file field: a labelled file input, shown as a button, inside a box a file can be dragged
 * onto. The native input is kept, visually hidden, so the keyboard and screen readers use the
 * browser's own file picker; its own "No file chosen" text would not be translated.
 */
export function FileDrop({ file, problem, onChoose, inputRef }: FileDropProps) {
  const locale = useLocale()
  const id = useId()
  const hintId = useId()
  const chosenId = useId()
  const problemId = useId()
  const zone = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  // A file dropped beside the box would open in the tab, and the page would be gone.
  useEffect(() => {
    const refuse = (event: globalThis.DragEvent) => {
      if (!hasFiles(event) || zone.current?.contains(event.target as Node)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    }
    window.addEventListener('dragover', refuse)
    window.addEventListener('drop', refuse)
    return () => {
      window.removeEventListener('dragover', refuse)
      window.removeEventListener('drop', refuse)
    }
  }, [])

  const over = (event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }

  const name = (text: string) => <bdi>{text}</bdi>
  const megabytes = (bytes: number) => {
    // Rounded up, so a file just over the limit never reads as the limit itself.
    const tenths = Math.ceil((bytes / BYTES_PER_MB) * 10)
    return formatNumber(tenths / 10, locale, tenths % 10 === 0 ? 0 : 1)
  }
  const limit = formatNumber(MAX_FILE_MB, locale)

  return (
    <div className={styles.field}>
      <div
        ref={zone}
        className={dragging ? `${styles.zone} ${styles.dragging}` : styles.zone}
        onDragEnter={over}
        onDragOver={over}
        onDragLeave={(event) => {
          if (!zone.current?.contains(event.relatedTarget as Node | null)) setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          const dropped = event.dataTransfer.files[0]
          if (dropped) onChoose(dropped)
        }}
      >
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".csv,text/csv"
          className={`visually-hidden ${styles.input}`}
          aria-describedby={`${hintId} ${chosenId} ${problemId}`}
          aria-invalid={problem ? true : undefined}
          onChange={(event) => {
            const chosen = event.target.files?.[0]
            // Emptied, so the same file can be chosen again once it has been fixed.
            event.target.value = ''
            if (chosen) onChoose(chosen)
          }}
        />
        <label htmlFor={id} className={styles.button}>
          <FormattedMessage id="upload.file.choose" />
        </label>
        <span className={styles.or}>
          <FormattedMessage id="upload.file.drag" />
        </span>
        <p id={hintId} className={styles.hint}>
          <FormattedMessage id="upload.file.limit" values={{ limit }} />
        </p>
      </div>

      <p id={chosenId} role="status" className={styles.chosen}>
        {file && <FormattedMessage id="upload.file.chosen" values={{ name: name(file.name) }} />}
      </p>
      <div id={problemId} role="alert">
        {problem && (
          <p className={styles.problem}>
            {problem.kind === 'missing' ? (
              <FormattedMessage id="upload.file.missing" />
            ) : problem.kind === 'too_big' ? (
              <FormattedMessage
                id="upload.file.tooBig"
                values={{ name: name(problem.name), size: megabytes(problem.bytes), limit }}
              />
            ) : (
              <FormattedMessage
                id={
                  problem.kind === 'not_csv'
                    ? 'upload.file.notCsv'
                    : problem.kind === 'unreadable'
                      ? 'upload.file.unreadable'
                      : 'upload.file.allZero'
                }
                values={{ name: name(problem.name) }}
              />
            )}
          </p>
        )}
      </div>
    </div>
  )
}
