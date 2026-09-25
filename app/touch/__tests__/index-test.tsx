import React from 'react'
import { Text } from 'react-native'
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer'
import { RawTouchSample, TouchGesture, TouchGestureSample, TouchState } from 'senswear'
import TouchScreen from '../index'
import * as FileSystem from 'expo-file-system'
import { TOUCH_GESTURE_LIMIT, TOUCH_HISTORY_LIMIT, TOUCH_UPDATE_MS } from '@/hooks/useTouchDemo'

let mockConnected = true
let mockFocused = true
let mockStateCallback: (sample: TouchState) => void
let mockRawCallback: (sample: RawTouchSample) => void
let mockGestureCallback: (sample: TouchGestureSample) => void
const mockTouch = {
  isSamplingEnabled: jest.fn(),
  setSamplingEnabled: jest.fn(),
  readState: jest.fn(),
  subscribeState: jest.fn(),
  subscribeGesture: jest.fn(),
  subscribeRaw: jest.fn(),
  unsubscribeState: jest.fn(),
  unsubscribeGesture: jest.fn(),
  unsubscribeRaw: jest.fn(),
}
const mockClient = { touch: mockTouch }

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}),
}))

jest.mock('@/hooks/BleSessionProvider', () => ({
  useBle: () => ({ client: mockConnected ? mockClient : null, isConnected: mockConnected }),
}))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const ReactHooks = require('react')
    ReactHooks.useEffect(() => mockFocused ? callback() : undefined, [callback, mockFocused])
  },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Line: 'Line', Path: 'Path' }))

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join('')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (React.isValidElement<{ children?: unknown }>(value)) return text(value.props.children)
  return ''
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function settle() {
  for (let i = 0; i < 30; i++) await Promise.resolve()
}

describe('TouchScreen firmware slider integration', () => {
  let tree: ReactTestRenderer | undefined
  const read = (id: string) => text(tree!.root.findByProps({ testID: id }).props.children)
  const flush = () => act(() => { jest.advanceTimersByTime(TOUCH_UPDATE_MS) })
  const mount = async () => {
    await act(async () => {
      tree = renderer.create(<TouchScreen />)
      await settle()
    })
  }
  const gesture = (value: TouchGesture, raw = 0x10) => {
    act(() => mockGestureCallback(new TouchGestureSample(1000000n, value, raw)))
    flush()
  }

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockConnected = true
    mockFocused = true
    mockTouch.isSamplingEnabled.mockResolvedValue(false)
    mockTouch.setSamplingEnabled.mockResolvedValue(undefined)
    mockTouch.readState.mockResolvedValue(new TouchState(0n, false, 0, 0))
    mockTouch.subscribeState.mockImplementation(async (callback) => { mockStateCallback = callback })
    mockTouch.subscribeRaw.mockImplementation(async (callback) => { mockRawCallback = callback })
    mockTouch.subscribeGesture.mockImplementation(async (callback) => { mockGestureCallback = callback })
    mockTouch.unsubscribeState.mockResolvedValue(undefined)
    mockTouch.unsubscribeGesture.mockResolvedValue(undefined)
    mockTouch.unsubscribeRaw.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    await act(async () => { tree?.unmount(); await settle() })
    tree = undefined
    jest.useRealTimers()
  })

  it('subscribes before enabling and maps host touch independently of hardware TCH', async () => {
    await mount()
    expect(mockTouch.subscribeRaw.mock.invocationCallOrder[0]).toBeLessThan(mockTouch.setSamplingEnabled.mock.invocationCallOrder[0])
    expect(read('touch-status')).toBe('Ready for touch')
    act(() => mockRawCallback(new RawTouchSample(1000n, true, 448, 0, 0)))
    expect(read('touch-status')).toBe('Ready for touch')
    flush()
    expect(read('touch-status')).toBe('Touch active')
    expect(read('touch-position')).toBe('448 / 896')
    expect(read('touch-distance')).toBe('21.0 mm')
    expect(read('touch-diagnostics')).toContain('Firmware touched: yes')
    expect(read('touch-diagnostics')).toContain('Raw status: 0x00')
    expect(tree!.root.findByProps({ testID: 'touch-pad-8' }).props.accessibilityLabel).toContain('nearest to touch')
    expect(tree!.root.findAll((node) => typeof node.props.testID === 'string' && /^touch-pad-\d+$/.test(node.props.testID) && typeof node.type !== 'string')).toHaveLength(15)
    act(() => mockStateCallback(new TouchState(2000n, false, 0, 0)))
    flush()
    expect(read('touch-position')).toBe('-- / 896')
    expect(tree!.root.findAllByProps({ testID: 'touch-marker' })).toHaveLength(0)
  })

  it('batches high-rate raw frames and retains a bounded waveform with release gaps', async () => {
    await mount()
    act(() => {
      for (let i = 1; i <= 500; i++) {
        mockRawCallback(new RawTouchSample(BigInt(i * 1000), i % 7 !== 0, i % 897, 0, 0))
      }
    })
    expect(read('touch-history-count')).toContain('0 recent frames')
    flush()
    expect(read('touch-history-count')).toContain(`${TOUCH_HISTORY_LIMIT} recent frames`)
    expect(read('touch-history-count')).toContain('500 received')
    const path = tree!.root.findByProps({ testID: 'touch-waveform-path' }).props.d as string
    expect(path.split('M').length).toBeGreaterThan(2)
    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: 'Clear touch history' }).props.onPress()
    })
    expect(read('touch-history-count')).toContain('0 recent frames')
  })

  it('uses normalized gestures for the demo and caps the event log', async () => {
    await mount()
    gesture(TouchGesture.SingleClick, 0x61)
    expect(read('touch-gesture')).toBe('Single tap')
    expect(read('sandbox-state')).toBe('Light on · Tile 3')
    gesture(TouchGesture.RightSwipe)
    expect(read('sandbox-state')).toBe('Light on · Tile 4')
    gesture(TouchGesture.LeftSwipeAndHold)
    expect(read('sandbox-state')).toBe('Light on · Tile 3')
    expect(read('sandbox-lock')).toBe('LOCKED')
    act(() => mockStateCallback(new TouchState(2000000n, true, 896, 0)))
    flush()
    expect(read('sandbox-level')).toContain('Level 50%')
    gesture(TouchGesture.ClickAndHold)
    expect(read('sandbox-lock')).toBe('FOLLOWING')
    gesture(TouchGesture.DoubleClick)
    expect(read('sandbox-state')).toBe('Light off · Tile 3')
    gesture(TouchGesture.UpSwipe)
    expect(read('touch-gesture')).toBe(`Unsupported gesture (${TouchGesture.UpSwipe})`)
    expect(read('sandbox-state')).toBe('Light off · Tile 3')
    for (let i = 0; i < 20; i++) gesture(TouchGesture.RightSwipe)
    expect(read('sandbox-state')).toBe('Light off · Tile 5')
    expect(tree!.root.findAllByType(Text).filter((node) => text(node.props.children) === '1000 ms')).toHaveLength(TOUCH_GESTURE_LIMIT)
  })

  it('unsubscribes all streams and restores originally disabled sampling on blur', async () => {
    await mount()
    await act(async () => { tree!.unmount(); tree = undefined; await settle() })
    expect(mockTouch.unsubscribeState).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeGesture).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeRaw).toHaveBeenCalledTimes(1)
    expect(mockTouch.setSamplingEnabled.mock.calls).toEqual([[true], [false]])
    expect(jest.getTimerCount()).toBe(0)
    expect(() => mockRawCallback(new RawTouchSample(1000n, true, 896, 0, 0))).not.toThrow()
  })

  it('restores an originally enabled stream after pausing it interactively', async () => {
    mockTouch.isSamplingEnabled.mockResolvedValue(true)
    await mount()
    expect(mockTouch.setSamplingEnabled).not.toHaveBeenCalled()
    await act(async () => {
      tree!.root.findByProps({ testID: 'touch-sampling' }).props.onValueChange(false)
      await settle()
    })
    expect(read('touch-status')).toBe('Paused')
    act(() => mockRawCallback(new RawTouchSample(1000n, true, 896, 0, 0)))
    flush()
    expect(read('touch-position')).toBe('-- / 896')
    await act(async () => { tree!.unmount(); tree = undefined; await settle() })
    expect(mockTouch.setSamplingEnabled.mock.calls).toEqual([[false], [true]])
  })

  it('reports control errors and leaves the last confirmed sampling setting', async () => {
    await mount()
    mockTouch.setSamplingEnabled.mockRejectedValueOnce(new Error('Write failed'))
    await act(async () => {
      tree!.root.findByProps({ testID: 'touch-sampling' }).props.onValueChange(false)
      await settle()
    })
    expect(tree!.root.findByProps({ testID: 'touch-sampling' }).props.value).toBe(true)
    expect(tree!.root.findByProps({ testID: 'touch-sampling' }).props.disabled).toBe(false)
    expect(tree!.root.findAllByProps({ accessibilityRole: 'alert' }).some((node) => text(node.props.children).includes('Write failed'))).toBe(true)
  })

  it('shows setup failure, removes partial subscriptions and supports retry', async () => {
    mockTouch.subscribeRaw.mockRejectedValueOnce(new Error('No touch shield'))
    await mount()
    expect(read('touch-status')).toBe('Unavailable')
    expect(mockTouch.unsubscribeState).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeGesture).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeRaw).toHaveBeenCalledTimes(1)
    expect(mockTouch.setSamplingEnabled).not.toHaveBeenCalled()
    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: 'Retry touch connection' }).props.onPress()
      await settle()
    })
    expect(read('touch-status')).toBe('Ready for touch')
  })

  it('restores sampling if startup fails after enabling', async () => {
    mockTouch.readState.mockRejectedValueOnce(new Error('State read failed'))
    await mount()
    expect(read('touch-status')).toBe('Unavailable')
    expect(mockTouch.setSamplingEnabled.mock.calls).toEqual([[true], [false]])
  })

  it('leaves an originally enabled stream enabled when no control change was made', async () => {
    mockTouch.isSamplingEnabled.mockResolvedValue(true)
    await mount()
    await act(async () => { tree!.unmount(); tree = undefined; await settle() })
    expect(mockTouch.setSamplingEnabled).not.toHaveBeenCalled()
    expect(mockTouch.unsubscribeRaw).toHaveBeenCalledTimes(1)
  })

  it('reports the initial sampling-state read error without leaving a loading state', async () => {
    mockTouch.isSamplingEnabled.mockRejectedValueOnce(new Error('Touch service unavailable'))
    await mount()
    expect(read('touch-status')).toBe('Unavailable')
    expect(mockTouch.subscribeState).not.toHaveBeenCalled()
    expect(mockTouch.setSamplingEnabled).not.toHaveBeenCalled()
  })

  it('does not create subscriptions after a pending read completes on an unfocused screen', async () => {
    const initial = deferred<boolean>()
    mockTouch.isSamplingEnabled.mockReturnValueOnce(initial.promise)
    await mount()
    await act(async () => { tree!.unmount(); tree = undefined; initial.resolve(false); await settle() })
    expect(mockTouch.subscribeState).not.toHaveBeenCalled()
    expect(mockTouch.setSamplingEnabled).not.toHaveBeenCalled()
  })

  it('serializes refocus behind pending subscription cleanup', async () => {
    const subscribed = deferred<void>()
    mockTouch.subscribeState.mockReturnValueOnce(subscribed.promise)
    await mount()
    act(() => { mockFocused = false; tree!.update(<TouchScreen />) })
    act(() => { mockFocused = true; tree!.update(<TouchScreen />) })
    expect(mockTouch.isSamplingEnabled).toHaveBeenCalledTimes(1)
    await act(async () => { subscribed.resolve(); await settle() })
    expect(mockTouch.unsubscribeState).toHaveBeenCalledTimes(1)
    expect(mockTouch.subscribeState).toHaveBeenCalledTimes(2)
    expect(mockTouch.subscribeGesture).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeState.mock.invocationCallOrder[0]).toBeLessThan(mockTouch.subscribeState.mock.invocationCallOrder[1])
    expect(read('touch-status')).toBe('Ready for touch')
  })

  it('cleans other resources even when one unsubscribe fails', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {})
    await mount()
    mockTouch.unsubscribeState.mockRejectedValueOnce(new Error('Disconnected'))
    await act(async () => { tree!.unmount(); tree = undefined; await settle() })
    expect(mockTouch.unsubscribeGesture).toHaveBeenCalledTimes(1)
    expect(mockTouch.unsubscribeRaw).toHaveBeenCalledTimes(1)
    expect(mockTouch.setSamplingEnabled).toHaveBeenLastCalledWith(false)
    expect(warning).toHaveBeenCalled()
    warning.mockRestore()
  })

  it('protects a newly mounted screen from the previous instance cleanup', async () => {
    const subscribed = deferred<void>()
    mockTouch.subscribeState.mockReturnValueOnce(subscribed.promise)
    await mount()
    act(() => { tree!.unmount(); tree = undefined })
    await mount()
    expect(mockTouch.isSamplingEnabled).toHaveBeenCalledTimes(1)
    await act(async () => { subscribed.resolve(); await settle() })
    expect(mockTouch.unsubscribeState).toHaveBeenCalledTimes(1)
    expect(mockTouch.subscribeState).toHaveBeenCalledTimes(2)
    expect(mockTouch.unsubscribeState.mock.invocationCallOrder[0]).toBeLessThan(mockTouch.subscribeState.mock.invocationCallOrder[1])
    expect(read('touch-status')).toBe('Ready for touch')
  })

  it('rejects legacy 2D coordinates in the visualizer and handles disconnected state', async () => {
    await mount()
    act(() => mockStateCallback(new TouchState(1000n, true, 2048, 100)))
    flush()
    expect(read('touch-position')).toBe('-- / 896')
    expect(tree!.root.findAllByProps({ accessibilityRole: 'alert' }).some((node) => text(node.props.children).includes('outside the current 1D range'))).toBe(true)
    await act(async () => { mockConnected = false; tree!.update(<TouchScreen />); await settle() })
    expect(read('touch-status')).toBe('Disconnected')
    expect(tree!.root.findByProps({ testID: 'touch-sampling' }).props.disabled).toBe(true)
  })

  it('continues displaying samples after the device realtime clock moves backwards', async () => {
    await mount()
    act(() => mockRawCallback(new RawTouchSample(2000000n, true, 128, 0, 0)))
    flush()
    act(() => mockRawCallback(new RawTouchSample(1000000n, true, 768, 0, 0)))
    flush()
    expect(read('touch-position')).toBe('768 / 896')
    expect(read('touch-history-count')).toContain('1 recent frames')
    expect(read('touch-history-count')).toContain('2 received')
  })

  it('does not replace a live notification with a delayed initial read', async () => {
    const initial = deferred<TouchState>()
    mockTouch.readState.mockReturnValueOnce(initial.promise)
    await mount()
    act(() => mockRawCallback(new RawTouchSample(1000n, true, 768, 0, 0)))
    await act(async () => { initial.resolve(new TouchState(500n, true, 64, 0)); await settle() })
    expect(read('touch-position')).toBe('768 / 896')
  })

  it('exports raw touch, normalized gestures and failed controls with exact device time', async () => {
    await mount()
    act(() => mockRawCallback(new RawTouchSample(18446744073709551615n, true, 448, 0, 3)))
    act(() => mockGestureCallback(new TouchGestureSample(1000n, TouchGesture.SingleClick, 0x61)))
    mockTouch.setSamplingEnabled.mockRejectedValueOnce(new Error('Write failed'))
    await act(async () => {
      await tree!.root.findByProps({ testID: 'touch-sampling' }).props.onValueChange(false)
      await settle()
    })
    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: 'Share CSV' }).props.onPress()
      await settle()
    })
    const csv = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][1]
    expect(csv).toContain('x_controller_units,y_controller_units,position_mm,gesture,gesture_state,touch_state')
    expect(csv).toContain(',18446744073709551615,raw,true,448,0,21,,,3,')
    expect(csv).toContain(',1000,gesture,,,,,1,97,')
    expect(csv).toContain(',false,write_failed,Write failed')
  })
})
