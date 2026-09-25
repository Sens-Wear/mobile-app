import { useCallback, useEffect, useState } from 'react'
import type { DeviceCapabilities, SenswearClient } from 'senswear'

const READ_TIMEOUT_MS = 10_000

type Metadata = {
  firmwareVersion: string | null
  capabilities: DeviceCapabilities | null
  isLoadingDeviceInfo: boolean
  deviceInfoError: Error | null
}

const EMPTY: Metadata = {
  firmwareVersion: null, capabilities: null, isLoadingDeviceInfo: false, deviceInfoError: null,
}

/** Metadata belongs to this connection only; never reuse capabilities after reconnecting. */
export function useDeviceMetadata(client: SenswearClient | null, isConnected: boolean) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    client: SenswearClient | null
    attempt: number
    metadata: Metadata
  } | null>(null)
  const refreshDeviceInfo = useCallback(() => setAttempt((value) => value + 1), [])

  useEffect(() => {
    if (!client || !isConnected) {
      setResult(null)
      return
    }
    let active = true
    let pending = 2
    const metadata: Metadata = { ...EMPTY, isLoadingDeviceInfo: true }
    const publish = () => {
      if (active) setResult({ client, attempt, metadata: { ...metadata } })
    }
    publish()
    const timer = setTimeout(() => {
      metadata.isLoadingDeviceInfo = false
      metadata.deviceInfoError = new Error('Firmware information timed out. Try refreshing.')
      publish()
      active = false
    }, READ_TIMEOUT_MS)
    const read = async (operation: () => Promise<void>) => {
      try {
        await operation()
      } catch {
        metadata.deviceInfoError = new Error('Firmware information unavailable. Refresh or update the firmware.')
      } finally {
        pending -= 1
        metadata.isLoadingDeviceInfo = pending !== 0
        if (pending === 0) clearTimeout(timer)
        publish()
      }
    }
    void read(async () => { metadata.firmwareVersion = await client.deviceInfo.readFirmwareVersion() })
    void read(async () => { metadata.capabilities = await client.deviceInfo.readCapabilities() })

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [client, isConnected, attempt])

  const metadata = !client || !isConnected ? EMPTY
    : result?.client === client && result.attempt === attempt ? result.metadata
      : { ...EMPTY, isLoadingDeviceInfo: true }
  return { ...metadata, refreshDeviceInfo }
}
