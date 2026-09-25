import React from 'react'
import { TouchableOpacity, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { DeviceCapabilities } from 'senswear'
import SensorsScreen from '../sensors'
import { FeatureGate } from '@/components/FeatureGate'

const mockPush = jest.fn()
const mockRefresh = jest.fn()
let mockConnected = true
let mockCapabilities: DeviceCapabilities | null = null
jest.mock('@/hooks/BleSessionProvider', () => ({
  useBle: () => ({
    isConnected: mockConnected, capabilities: mockCapabilities, client: null,
    isLoadingDeviceInfo: false, refreshDeviceInfo: mockRefresh,
  }),
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }))
jest.mock('react-native-progress', () => ({ Circle: () => null }))

describe('firmware-gated navigation', () => {
  let tree: ReactTestRenderer
  beforeEach(() => {
    mockConnected = true
    mockCapabilities = new DeviceCapabilities(1, 8, 35)
    jest.clearAllMocks()
  })
  afterEach(() => act(() => tree?.unmount()))

  it('allows supported cards and prevents even direct disabled-card handlers from navigating', async () => {
    await act(async () => { tree = create(<SensorsScreen />) })
    const buttons = tree.root.findAllByType(TouchableOpacity)
    const touch = buttons.find((button) => button.props.accessibilityLabel === 'Touch')!
    const ppg = buttons.find((button) => button.props.accessibilityLabel === 'PPG')!
    expect(touch.props.disabled).toBe(false)
    expect(ppg.props.disabled).toBe(true)
    act(() => ppg.props.onPress())
    expect(mockPush).not.toHaveBeenCalled()
    act(() => touch.props.onPress())
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/touch' })
  })

  it.each([true, false])('disables all cards without capabilities (connected=%s)', async (connected) => {
    mockConnected = connected
    mockCapabilities = null
    await act(async () => { tree = create(<SensorsScreen />) })
    const cards = tree.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityLabel)
    expect(cards).toHaveLength(6)
    expect(cards.every((node) => node.props.disabled)).toBe(true)
  })

  it('blocks a deep-linked screen before its effects can run, then mounts when supported', async () => {
    const mounted = jest.fn()
    function Screen() { React.useEffect(mounted, []); return <Text>Sensor content</Text> }
    await act(async () => { tree = create(<FeatureGate moduleKey="PPG"><Screen /></FeatureGate>) })
    expect(mounted).not.toHaveBeenCalled()
    mockCapabilities = new DeviceCapabilities(1, 2, 8)
    await act(async () => tree.update(<FeatureGate moduleKey="PPG"><Screen /></FeatureGate>))
    expect(mounted).toHaveBeenCalledTimes(1)
  })
})
