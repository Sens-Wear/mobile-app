import React from 'react'
import { Alert } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { CsvLogProvider, useCsvExport } from '../useCsvExport'

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }))
const columns = ['received_at_utc', 'timestamp_us', 'value']
let capture: ReturnType<typeof useCsvExport>
function Harness() { capture = useCsvExport('Test', columns); return null }

describe('CSV sharing', () => {
  let tree: renderer.ReactTestRenderer
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true)
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined)
    jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined)
    act(() => { tree = renderer.create(<Harness />) })
  })
  afterEach(() => { act(() => tree.unmount()); jest.restoreAllMocks() })

  it('shows a no-data message instead of creating an empty file', async () => {
    await act(async () => { await capture.share() })
    expect(Alert.alert).toHaveBeenCalledWith('No records to export', expect.any(String))
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled()
  })
  it('writes precise timestamps and invokes the native CSV share sheet', async () => {
    capture.record({ timestamp_us: 18446744073709551615n, value: 1.25 })
    await act(async () => { await capture.share() })
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith('file:///cache/senswear-test.csv',
      expect.stringContaining(',18446744073709551615,1.25\r\n'), { encoding: 'utf8' })
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/senswear-test.csv',
      expect.objectContaining({ mimeType: 'text/csv' }))
  })
  it('reports unavailable sharing and write failures without losing the log', async () => {
    capture.record({ value: 2 })
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValueOnce(false)
    await act(async () => { await capture.share() })
    expect(Alert.alert).toHaveBeenLastCalledWith('Sharing unavailable', expect.any(String))
    jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error('Disk full'))
    await act(async () => { await capture.share() })
    expect(Alert.alert).toHaveBeenLastCalledWith('CSV export failed', 'Disk full')
    expect(Sharing.shareAsync).not.toHaveBeenCalled()
    await act(async () => { await capture.share() })
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1)
  })
  it('serializes repeated taps and recovers after share failure', async () => {
    capture.record({ value: 3 })
    jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error('Share failed'))
    await act(async () => { await Promise.all([capture.share(), capture.share()]) })
    expect(Sharing.shareAsync).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenLastCalledWith('CSV export failed', 'Share failed')
    expect(capture.sharing).toBe(false)
  })
  it('preserves a visit log when a capability gate remounts its screen', async () => {
    act(() => { tree.update(<CsvLogProvider><Harness /></CsvLogProvider>) })
    capture.record({ value: 11 })
    const pendingWriteResult = capture.record
    act(() => { tree.update(<CsvLogProvider>{null}</CsvLogProvider>) })
    pendingWriteResult({ value: 33 })
    act(() => { tree.update(<CsvLogProvider><Harness /></CsvLogProvider>) })
    capture.record({ value: 22 })
    await act(async () => { await capture.share() })
    const csv = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1]
    expect(csv).toContain(',,11\r\n')
    expect(csv).toContain(',,33\r\n')
    expect(csv).toContain(',,22\r\n')
    act(() => { tree.update(<Harness />) })
    await act(async () => { await capture.share() })
    expect(Alert.alert).toHaveBeenLastCalledWith('No records to export', expect.any(String))
  })
})
