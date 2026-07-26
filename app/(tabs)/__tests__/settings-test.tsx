import React from 'react'
import { Text } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import SettingsScreen from '../settings'

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
    isConnected: true,
  }),
}))

jest.mock('@/hooks/useFocusedDaughterBoardState', () => ({
  useFocusedDaughterBoardState: () => ({
    connectedBoardNames: ['Touch'],
  }),
}))

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

    act(() => {
      tree!.unmount()
    })
  })
})
