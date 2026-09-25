import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { CsvLog, type CsvRecord } from '@/utils/csv'
import { CsvLogContext } from './CsvLogProvider'
export { CsvLogProvider } from './CsvLogProvider'

/** Pass a module-level column list. Records live for this screen/provider's visit. */
export function useCsvExport(name: string, columns: readonly string[]) {
  const sharedLogs = useContext(CsvLogContext)
  const log = useRef<CsvLog | null>(null)
  if (!log.current) {
    log.current = sharedLogs?.get(name) ?? new CsvLog(columns)
    sharedLogs?.set(name, log.current)
  }
  const busy = useRef(false)
  const mounted = useRef(true)
  const [sharing, setSharing] = useState(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const record = useCallback((row: CsvRecord) => {
    // A pending actuator write may settle while a reconnect gate hides its screen.
    if (mounted.current || sharedLogs) log.current!.append({ received_at_utc: new Date().toISOString(), ...row })
  }, [sharedLogs])
  const clear = useCallback(() => log.current!.clear(), [])
  const share = useCallback(async () => {
    if (busy.current) return
    if (!log.current!.size) {
      Alert.alert('No records to export', 'Capture samples or interact with the device first.')
      return
    }
    busy.current = true
    setSharing(true)
    try {
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('Sharing unavailable', 'CSV sharing is not available on this device.')
        return
      }
      if (!FileSystem.cacheDirectory) throw new Error('The app cache is unavailable.')
      // Reuse one cache file per feature instead of accumulating sensor recordings.
      const uri = `${FileSystem.cacheDirectory}senswear-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}.csv`
      await FileSystem.writeAsStringAsync(uri, log.current!.toCsv(), {
        encoding: FileSystem.EncodingType.UTF8,
      })
      if (!mounted.current) return
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: `Share ${name} CSV`,
      })
    } catch (error) {
      if (mounted.current) Alert.alert('CSV export failed', error instanceof Error ? error.message : String(error))
    } finally {
      busy.current = false
      if (mounted.current) setSharing(false)
    }
  }, [name])

  return { record, clear, share, sharing }
}
