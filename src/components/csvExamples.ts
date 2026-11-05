// What a CSV file may hold, as shown in the format help and in the error messages. They are
// file contents, so they are shown as a file writes them, never in the language's own digits,
// and they come from here rather than from the copy, so a translation cannot change them.
// UploadPage.test.tsx checks that the reader takes each one as the help says.

export const CSV_EXAMPLES = {
  isoDate: '2026-10-31',
  dayFirstDate: '31/10/2026',
  monthFirstDate: '10/31/2026',
  moneyIn: '55000',
  moneyOut: '-1250.50',
  currency: 'USD',
} as const
