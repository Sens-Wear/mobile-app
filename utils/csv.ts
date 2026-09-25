export type CsvValue = string | number | bigint | boolean | null | undefined
export type CsvRecord = Readonly<Record<string, CsvValue>>
export const CSV_RECORD_LIMIT = 20000

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  // Keep free-form text from becoming a formula when a CSV is opened in a spreadsheet.
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Fixed-size ring: high-rate streams never grow an unbounded CSV array. */
export class CsvLog {
  private rows: { sequence: number; record: CsvRecord }[] = []
  private next = 0
  private total = 0

  constructor(readonly columns: readonly string[], readonly limit = CSV_RECORD_LIMIT) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('CSV limit must be positive')
  }

  get size() { return this.rows.length }
  get dropped() { return this.total - this.rows.length }

  clear() {
    this.rows = []
    this.next = 0
    this.total = 0
  }

  append(record: CsvRecord) {
    this.rows[this.next] = { sequence: ++this.total, record: { ...record } }
    this.next = (this.next + 1) % this.limit
  }

  toCsv(): string {
    const ordered = this.rows.length === this.limit
      ? [...this.rows.slice(this.next), ...this.rows.slice(0, this.next)] : this.rows
    return [
      ['record_number', ...this.columns].map(csvCell).join(','),
      ...ordered.map(({ sequence, record }) =>
        [sequence, ...this.columns.map((column) => record[column])].map(csvCell).join(',')),
    ].join('\r\n') + '\r\n'
  }
}
