import React from 'react'
import { Text } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import SettingsScreen from '../settings'
import { DeviceCapabilities } from 'senswear'

let mockConnected = true
let mockLoading = false
let mockCapabilities: DeviceCapabilities | null = new DeviceCapabilities(1, 8, 0xe3)
let mockVersion: string | null = '0.1.0+0'

const mockClient = {
  battery: {
    read: jest.fn().mockResolvedValue({ percent: 75 }),
    subscribe: jest.fn().mockResolvedValue(undefined),
  },
  power: {
    read: jest.fn().mockResolvedValue({ batteryPresent: true, chargeState: 0 }),
    subscribe: jest.fn().mockResolvedValue(undefined),
  },
  stopNotify: jest.fn().mockResolvedValue(undefined),
}

jest.mock('@/hooks/BleSessionProvider', () => ({
  useBle: () => ({
    forget: jest.fn(),
    client: mockClient,
    isConnected: mockConnected,
    capabilities: mockCapabilities,
    firmwareVersion: mockVersion,
    isLoadingDeviceInfo: mockLoading,
    deviceInfoError: null,
    refreshDeviceInfo: jest.fn(),
  }),
}))

jest.mock('expo-application', () => ({ nativeApplicationVersion: '2.8.1' }))
jest.mock('expo-constants', () => ({ expoConfig: { version: '9.9.9' } }))
jest.mock('expo-file-system', () => ({}))
jest.mock('expo-sharing', () => ({}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react')
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback])
    },
    useNavigation: () => ({ getParent: () => null }),
  }
})

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native')
  return { LinearGradient: View }
})

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}))

jest.mock('react-native-progress', () => ({
  Circle: () => null,
}))

describe('SettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConnected = true
    mockLoading = false
    mockCapabilities = new DeviceCapabilities(1, 8, 0xe3)
    mockVersion = '0.1.0+0'
  })
  it('omits telemetry sections that are not part of the settings BLE interface', async () => {
    let tree: renderer.ReactTestRenderer
    await act(async () => {
      tree = renderer.create(<SettingsScreen />)
      await Promise.resolve()
    })

    const labels = tree!.root.findAllByType(Text).map((node) => node.props.children).flat()

    expect(labels).not.toContain('Temperature')
    expect(labels).not.toContain('Voltage')
    expect(labels).not.toContain('Battery overview')
    expect(labels).not.toContain('Battery capacity')
    expect(labels).not.toContain('Average current')
    expect(labels).not.toContain('Average power')
    expect(labels).toContain('Platform details')
    expect(labels).toContain('Available daughter boards')
    expect(labels).toContain('PPG, Temperature, Touch, Haptic')
    expect(labels).toContain('Firmware shields')
    expect(labels).toContain('Touch')
    expect(labels).toContain('0.1.0+0')
    expect(labels).toContain('2.8.1')
    expect(labels).not.toContain('0.0.1')
    expect(labels).not.toContain('9.9.9')
    expect(labels).not.toContain('Connected daughter boards')
    expect(labels).not.toContain('Active daughter board')

    act(() => {
      tree!.unmount()
    })
  })

  it.each([
    [true, true, 'Reading firmware…'],
    [true, false, 'Unavailable'],
    [false, false, 'Not connected'],
  ])('shows honest metadata state connected=%s loading=%s', async (connected, loading, expected) => {
    mockConnected = connected
    mockLoading = loading
    mockCapabilities = null
    mockVersion = null
    let tree: renderer.ReactTestRenderer
    await act(async () => { tree = renderer.create(<SettingsScreen />) })
    const labels = tree!.root.findAllByType(Text).map((node) => node.props.children).flat()
    expect(labels).toContain(expected)
    expect(labels).toContain('PPG, Temperature, Touch, Haptic')
    expect(labels).not.toContain('None (base firmware)')
    act(() => tree!.unmount())
  })

  it('shows a valid zero-shield build as base firmware', async () => {
    mockCapabilities = new DeviceCapabilities(1, 0, 3)
    let tree: renderer.ReactTestRenderer
    await act(async () => { tree = renderer.create(<SettingsScreen />) })
    expect(tree!.root.findAllByType(Text).map((node) => node.props.children)).toContain('None (base firmware)')
    act(() => tree!.unmount())
  })

  it('does not subscribe when a power read finishes after leaving the page', async () => {
    let resolveBattery!: (sample: { percent: number }) => void
    mockClient.battery.read.mockReturnValueOnce(new Promise((resolve) => { resolveBattery = resolve }))
    let tree: renderer.ReactTestRenderer
    await act(async () => { tree = renderer.create(<SettingsScreen />) })
    act(() => tree!.unmount())
    await act(async () => resolveBattery({ percent: 70 }))
    expect(mockClient.battery.subscribe).not.toHaveBeenCalled()
    expect(mockClient.power.subscribe).not.toHaveBeenCalled()
    expect(mockClient.stopNotify).toHaveBeenCalledTimes(2)
  })
})
