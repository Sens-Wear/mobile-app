import React from 'react'
import { act, create } from 'react-test-renderer'

import { useBleSession } from '../useBleSession'

const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockReadFirmwareVersion = jest.fn()
const mockReadCapabilities = jest.fn()
const mockSetItem = jest.fn()
const mockGetItem = jest.fn()
const mockRemoveItem = jest.fn()
const mockRemoveDisconnectListener = jest.fn()
let mockDisconnectedCallback: ((error: Error | null) => void) | null = null
let mockNotificationErrorCallback:
  | ((error: unknown, characteristicUuid: string) => void)
  | null = null
let mockConnectionOptions: { requestMTU?: number } | undefined

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: (...args: unknown[]) => mockSetItem(...args),
  getItem: (...args: unknown[]) => mockGetItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}))

jest.mock('senswear', () => ({
  SenswearClient: jest.fn().mockImplementation(
    (
      deviceId: string,
      options: {
        connectionOptions?: { requestMTU?: number }
        onNotificationError?: (error: unknown, characteristicUuid: string) => void
      }
    ) => {
      mockConnectionOptions = options.connectionOptions
      mockNotificationErrorCallback = options.onNotificationError ?? null
      return {
        deviceId,
        connect: () => mockConnect(deviceId),
        disconnect: () => mockDisconnect(deviceId),
        deviceInfo: {
          readFirmwareVersion: () => mockReadFirmwareVersion(),
          readCapabilities: () => mockReadCapabilities(),
        },
      }
    }
  ),
}))

jest.mock('../../ble/bleManager', () => ({
  bleManager: {
    onDeviceDisconnected: jest.fn(
      (_deviceId: string, callback: (error: Error | null) => void) => {
        mockDisconnectedCallback = callback
        return { remove: mockRemoveDisconnectListener }
      }
    ),
  },
}))

type Session = ReturnType<typeof useBleSession>

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function SessionHarness({ onRender }: { onRender: (session: Session) => void }) {
  onRender(useBleSession())
  return null
}

describe('useBleSession reconnection', () => {
  let session: Session

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockDisconnectedCallback = null
    mockConnectionOptions = undefined
    mockNotificationErrorCallback = null
    mockConnect.mockResolvedValue(undefined)
    mockDisconnect.mockResolvedValue(undefined)
    mockReadFirmwareVersion.mockResolvedValue('0.1.0+0')
    mockReadCapabilities.mockResolvedValue({ shieldMask: 8, featureMask: 35 })
    mockSetItem.mockResolvedValue(undefined)
    mockGetItem.mockResolvedValue(null)
    mockRemoveItem.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('pairs successfully and persists the selected device', async () => {
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)

    await act(async () => {
      await session.pair('device-1')
    })

    expect(session.isConnected).toBe(true)
    expect(session.firmwareVersion).toBe('0.1.0+0')
    expect(session.capabilities?.shieldMask).toBe(8)
    expect(session.isReconnecting).toBe(false)
    expect(mockConnectionOptions).toEqual({ requestMTU: 247 })
    expect(mockSetItem).toHaveBeenCalledWith('paired_device_id', 'device-1')
    tree.unmount()
  })

  it('shows reconnecting state after failure and retries in the background', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Connection failed'))
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)

    await act(async () => {
      await session.pair('device-2')
    })
    expect(session.isReconnecting).toBe(true)

    expect(session.capabilities).toBeNull()
    expect(session.firmwareVersion).toBeNull()
    expect(session.error?.message).toBe('Connection failed')

    await act(async () => {
      jest.advanceTimersByTime(2_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockConnect).toHaveBeenCalledTimes(2)
    expect(session.isConnected).toBe(true)
    expect(session.isReconnecting).toBe(false)
    tree.unmount()
  })

  it('reconnects after an unexpected disconnect but not after an intentional one', async () => {
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    await act(async () => {
      await session.pair('device-3')
    })

    act(() => {
      mockDisconnectedCallback?.(new Error('Link lost'))
    })
    expect(session.isReconnecting).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(2_000)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockConnect).toHaveBeenCalledTimes(2)

    await act(async () => {
      await session.disconnect()
      jest.advanceTimersByTime(2_000)
    })
    expect(session.isReconnecting).toBe(false)
    expect(mockConnect).toHaveBeenCalledTimes(2)
    tree.unmount()
  })

  it('ignores notification cancellation caused by unsubscribing', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    await act(async () => {
      await session.pair('device-4')
    })

    act(() => {
      mockNotificationErrorCallback?.(
        { errorCode: 2, message: 'Operation was cancelled' },
        '2a19'
      )
    })

    expect(session.isConnected).toBe(true)
    expect(session.isReconnecting).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
    tree.unmount()
  })

  it('uses the persisted device for auto-connect and cleans up on unmount', async () => {
    mockGetItem.mockResolvedValue('saved-device')
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)

    await act(async () => {
      await session.autoConnect()
    })
    expect(session.deviceId).toBe('saved-device')

    act(() => {
      tree.unmount()
    })
    expect(mockRemoveDisconnectListener).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it.each(['disconnect', 'forget'] as const)('invalidates a pending pair on %s', async (operation) => {
    const connection = deferred<void>()
    mockConnect.mockReturnValueOnce(connection.promise)
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    let pairing!: ReturnType<Session['pair']>
    await act(async () => { pairing = session.pair('pending-device') })
    let stopping!: Promise<void>
    act(() => { stopping = session[operation]() })
    expect(session.deviceId).toBeNull()
    expect(session.client).toBeNull()
    expect(session.isConnected).toBe(false)
    await act(async () => {
      connection.resolve(undefined)
      await stopping
      expect(await pairing).toBeNull()
    })
    expect(mockDisconnect).toHaveBeenCalledWith('pending-device')
    expect(mockSetItem).not.toHaveBeenCalled()
    expect(session.capabilities).toBeNull()
    expect(session.firmwareVersion).toBeNull()
    expect(session.isReconnecting).toBe(false)
    if (operation === 'forget') expect(mockRemoveItem).toHaveBeenCalledWith('paired_device_id')
    act(() => jest.advanceTimersByTime(2_000))
    expect(mockConnect).toHaveBeenCalledTimes(1)
    act(() => tree.unmount())
  })

  it('cleans up an obsolete attempt before connecting the newer selection', async () => {
    const first = deferred<void>()
    mockConnect.mockReturnValueOnce(first.promise)
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    let firstPair!: ReturnType<Session['pair']>
    let secondPair!: ReturnType<Session['pair']>
    await act(async () => { firstPair = session.pair('first-device') })
    await act(async () => { secondPair = session.pair('second-device') })
    expect(mockConnect).toHaveBeenCalledTimes(1)
    expect(session.deviceId).toBe('second-device')
    await act(async () => {
      first.resolve(undefined)
      expect(await firstPair).toBeNull()
      expect((await secondPair)?.deviceId).toBe('second-device')
    })
    expect(mockDisconnect).toHaveBeenCalledWith('first-device')
    expect(mockDisconnect).not.toHaveBeenCalledWith('second-device')
    expect(mockSetItem.mock.calls).toEqual([['paired_device_id', 'second-device']])
    expect(session.deviceId).toBe('second-device')
    expect(session.isConnected).toBe(true)
    act(() => tree.unmount())
  })

  it('does not let an obsolete connection failure replace a newer attempt', async () => {
    const first = deferred<void>()
    mockConnect.mockReturnValueOnce(first.promise)
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    let firstPair!: ReturnType<Session['pair']>
    let secondPair!: ReturnType<Session['pair']>
    await act(async () => { firstPair = session.pair('first-device') })
    await act(async () => { secondPair = session.pair('second-device') })
    await act(async () => {
      first.reject(new Error('Obsolete failure'))
      await firstPair
      await secondPair
    })
    expect(session.deviceId).toBe('second-device')
    expect(session.error).toBeNull()
    expect(session.isConnected).toBe(true)
    expect(session.isReconnecting).toBe(false)
    act(() => tree.unmount())
  })

  it('clears old capabilities immediately and ignores stale client callbacks when switching', async () => {
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    await act(async () => { await session.pair('first-device') })
    expect(session.capabilities).not.toBeNull()
    const oldDisconnected = mockDisconnectedCallback
    const oldNotificationError = mockNotificationErrorCallback
    const closing = deferred<void>()
    mockDisconnect.mockReturnValueOnce(closing.promise)
    let nextPair!: ReturnType<Session['pair']>
    await act(async () => { nextPair = session.pair('second-device') })
    expect(session.client).toBeNull()
    expect(session.isConnected).toBe(false)
    expect(session.capabilities).toBeNull()
    expect(session.firmwareVersion).toBeNull()
    act(() => {
      oldDisconnected?.(new Error('Old link lost'))
      oldNotificationError?.(new Error('Old notification'), '2a19')
    })
    expect(session.deviceId).toBe('second-device')
    expect(session.isConnecting).toBe(true)
    expect(session.isReconnecting).toBe(false)
    await act(async () => {
      closing.resolve(undefined)
      await nextPair
    })
    act(() => oldDisconnected?.(new Error('Late old link event')))
    expect(session.deviceId).toBe('second-device')
    expect(session.isConnected).toBe(true)
    act(() => tree.unmount())
  })

  it('orders forget after an in-flight persistence write and before a new pairing', async () => {
    const writing = deferred<void>()
    const storageEvents: string[] = []
    mockSetItem.mockImplementationOnce(async () => {
      await writing.promise
      storageEvents.push('old-write')
    }).mockImplementationOnce(async () => { storageEvents.push('new-write') })
    mockRemoveItem.mockImplementationOnce(async () => { storageEvents.push('remove') })
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    let firstPair!: ReturnType<Session['pair']>
    await act(async () => { firstPair = session.pair('first-device') })
    expect(mockSetItem).toHaveBeenCalledTimes(1)
    let forgetting!: Promise<void>
    let secondPair!: ReturnType<Session['pair']>
    await act(async () => {
      forgetting = session.forget()
      secondPair = session.pair('second-device')
    })
    await act(async () => {
      writing.resolve(undefined)
      await Promise.all([firstPair, forgetting, secondPair])
    })
    expect(storageEvents).toEqual(['old-write', 'remove', 'new-write'])
    expect(session.deviceId).toBe('second-device')
    expect(session.isConnected).toBe(true)
    act(() => tree.unmount())
  })

  it('does not auto-connect after a pending saved-id lookup was cancelled', async () => {
    const lookup = deferred<string>()
    mockGetItem.mockReturnValueOnce(lookup.promise)
    const tree = create(<SessionHarness onRender={(value) => { session = value }} />)
    let connecting!: ReturnType<Session['autoConnect']>
    await act(async () => { connecting = session.autoConnect() })
    await act(async () => { await session.forget() })
    await act(async () => {
      lookup.resolve('old-device')
      expect(await connecting).toBeNull()
    })
    expect(mockConnect).not.toHaveBeenCalled()
    expect(session.deviceId).toBeNull()
    act(() => tree.unmount())
  })
})
