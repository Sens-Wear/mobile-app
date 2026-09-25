import React from 'react'
import { Text, TouchableOpacity } from 'react-native'
import renderer, { act, type ReactTestInstance } from 'react-test-renderer'
import { HapticPattern } from 'senswear'
import * as FileSystem from 'expo-file-system'
import VibrationScreen from '../index'

const mockVibrate = jest.fn()
const mockPlay = jest.fn()

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(callback, [callback]),
}))

jest.mock('@/hooks/BleSessionProvider', () => ({
  useBle: () => ({
    isConnected: true,
    client: {
      haptic: {
        vibrate: mockVibrate,
        play: mockPlay,
      },
    },
  }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}))

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native')
  return { LinearGradient: View }
})

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}))

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(textValue).join('')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return ''
}

function buttonWithText(root: ReactTestInstance, label: string): ReactTestInstance {
  const button = root.findAllByType(TouchableOpacity).find((candidate) =>
    candidate
      .findAllByType(Text)
      .some((text) => textValue(text.props.children) === label)
  )
  if (!button) throw new Error(`Button "${label}" not found`)
  return button
}

describe('VibrationScreen current SDK integration', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockVibrate.mockResolvedValue(undefined)
    mockPlay.mockResolvedValue(undefined)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('uses haptic.vibrate for a single pulse and locks overlapping playback', async () => {
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<VibrationScreen />) })

    await act(async () => {
      await buttonWithText(tree.root, 'Send Effect').props.onPress()
    })

    expect(mockVibrate).toHaveBeenCalledWith(160, 191)
    expect(mockPlay).not.toHaveBeenCalled()
    expect(buttonWithText(tree.root, 'Playing...').props.disabled).toBe(true)

    act(() => {
      jest.advanceTimersByTime(160)
      tree.unmount()
    })
  })

  it('uses haptic.play with a multi-frame RTP pattern', async () => {
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<VibrationScreen />) })

    act(() => {
      buttonWithText(tree.root, 'Pattern').props.onPress()
    })
    await act(async () => {
      await buttonWithText(tree.root, 'Send Effect').props.onPress()
    })

    expect(mockVibrate).not.toHaveBeenCalled()
    expect(mockPlay).toHaveBeenCalledTimes(1)
    const pattern = mockPlay.mock.calls[0][0]
    expect(pattern).toBeInstanceOf(HapticPattern)
    expect(pattern.frames).toHaveLength(8)
    expect(pattern.toBytes()).toHaveLength(28)

    act(() => {
      jest.advanceTimersByTime(640)
      tree.unmount()
    })
  })

  it('exports acknowledged frames and failures as separate command outcomes', async () => {
    let tree!: renderer.ReactTestRenderer
    act(() => { tree = renderer.create(<VibrationScreen />) })
    mockVibrate.mockRejectedValueOnce(new Error('Firmware busy'))
    await act(async () => { await buttonWithText(tree.root, 'Send Effect').props.onPress() })
    await act(async () => { await buttonWithText(tree.root, 'Send Effect').props.onPress() })
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Share CSV' }).props.onPress()
      for (let i = 0; i < 10; i++) await Promise.resolve()
    })
    const csv = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1]
    expect(csv).toContain('frame_duration_ms,intensity_0_255,total_duration_ms,result,error')
    expect(csv).toContain(',160,191,160,write_failed,Firmware busy')
    expect(csv).toContain(',160,191,160,write_succeeded,')
    act(() => tree.unmount())
  })
})
