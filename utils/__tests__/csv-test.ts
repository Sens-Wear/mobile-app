import { CsvLog, csvCell } from '../csv'

describe('CSV recording', () => {
  it('escapes delimiters and newlines without losing bigint precision or numeric signs', () => {
    const log = new CsvLog(['timestamp_us', 'message', 'value'])
    log.append({ timestamp_us: 18446744073709551615n, message: 'a,"quote"\nnext', value: -2.5 })
    expect(log.toCsv()).toBe('record_number,timestamp_us,message,value\r\n1,18446744073709551615,"a,""quote""\nnext",-2.5\r\n')
    expect(csvCell('=HYPERLINK("unsafe")')).toBe('"\'=HYPERLINK(""unsafe"")"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(false)).toBe('false')
  })

  it('keeps only the latest rows in chronological order and exposes dropped row numbers', () => {
    const log = new CsvLog(['value'], 3)
    for (let value = 0; value < 8; value++) log.append({ value })
    expect(log.size).toBe(3)
    expect(log.dropped).toBe(5)
    expect(log.toCsv()).toBe('record_number,value\r\n6,5\r\n7,6\r\n8,7\r\n')
    log.clear()
    log.append({ value: 99 })
    expect(log.toCsv()).toBe('record_number,value\r\n1,99\r\n')
  })
})
