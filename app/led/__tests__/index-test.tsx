import React from 'react'
import { Text } from 'react-native'
import renderer, { act } from 'react-test-renderer'
import * as FileSystem from 'expo-file-system'
import LEDScreen from '../index'

const mockLed = { off: jest.fn(), set: jest.fn() }
const mockClient = { led: mockLed }
jest.mock('@/hooks/BleSessionProvider', () => ({ useBle: () => ({ client: mockClient, isConnected: true }) }))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
}))
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => require('react').useRef({ value }).current,
}))
jest.mock('reanimated-color-picker', () => ({
  __esModule: true, default: 'ColorPicker', HueSlider: 'HueSlider', OpacitySlider: 'OpacitySlider', Panel3: 'Panel3',
}))
const settle = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }

describe('LED interaction CSV', () => {
  let tree: renderer.ReactTestRenderer
  beforeEach(async () => {
    jest.clearAllMocks()
    mockLed.off.mockResolvedValue(undefined)
    mockLed.set.mockResolvedValue(undefined)
    await act(async () => { tree = renderer.create(<LEDScreen />); await settle() })
  })
  afterEach(() => { act(() => tree.unmount()) })

  it('records colors only as successful device writes after SDK acknowledgement', async () => {
    mockLed.set.mockRejectedValueOnce(new Error('Disconnected during write'))
    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Turn LED on' }).props.onPress()
    })
    expect(tree.root.findByProps({ accessibilityLabel: 'Turn LED on' })).toBeDefined()
    expect(tree.root.findAllByType(Text).some((node) => node.props.children === 'Disconnected during write')).toBe(true)
    await act(async () => {
      await tree.root.findByProps({ accessibilityLabel: 'Turn LED on' }).props.onPress()
    })
    expect(tree.root.findByProps({ accessibilityLabel: 'Turn LED off' })).toBeDefined()
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Share CSV' }).props.onPress()
      await settle()
    })
    const csv = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1]
    expect(csv).toContain(',turn_on,#0000ff,write_failed,Disconnected during write')
    expect(csv).toContain(',turn_on,#0000ff,write_succeeded,')
  })
})
