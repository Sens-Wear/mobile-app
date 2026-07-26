import React from 'react'
import { act, create } from 'react-test-renderer'

import { useBleSession } from '../useBleSession'

const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockSetItem = jest.fn()
const mockGetItem = jest.fn()
const mockRemoveDisconnectListener = jest.fn()
let mockDisconnectedCallback: ((error: Error | null) => void) | null = null
let mockNotificationErrorCallback:
  | ((error: unknown, characteristicUuid: string) => void)
  | null = null
let mockConnectionOptions: { requestMTU?: number } | undefined

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: (...args: unknown[]) => mockSetItem(...args),
  getItem: (...args: unknown[]) => mockGetItem(...args),
  removeItem: jest.fn(),
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
        connect: () => mockConnect(),
        disconnect: () => mockDisconnect(),
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
    mockSetItem.mockResolvedValue(undefined)
    mockGetItem.mockResolvedValue(null)
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
})
