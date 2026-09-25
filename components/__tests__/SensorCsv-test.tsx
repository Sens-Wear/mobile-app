import React from 'react'
import renderer, { act } from 'react-test-renderer'
import * as FileSystem from 'expo-file-system'
import { AccelerometerSample, QuaternionSample, PpgSample, TemperatureMeasurement } from 'senswear'
import IMUScreen from '@/app/imu'
import PPGScreen from '@/app/ppg'
import TemperatureScreen from '@/app/temperature'

const mockImu = {
  setEnabled: jest.fn(), setDrainPeriodMs: jest.fn(), subscribeAccelerometer: jest.fn(),
  subscribeQuaternion: jest.fn(), unsubscribe: jest.fn(),
}
const mockPpg = {
  setSamplingEnabled: jest.fn(), subscribeRed: jest.fn(), subscribeInfrared: jest.fn(),
  subscribeGreen: jest.fn(), unsubscribe: jest.fn(),
}
const mockTemperature = {
  readMeasurementInterval: jest.fn(), setMeasurementInterval: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn(),
}
const mockClient = { imu: mockImu, ppg: mockPpg, temperature: mockTemperature }
let mockFocused = true
jest.mock('@/hooks/BleSessionProvider', () => ({ useBle: () => ({ client: mockClient, isConnected: true }) }))
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => require('react').useEffect(
    () => mockFocused ? callback() : undefined, [callback, mockFocused]),
}))
jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/', EncodingType: { UTF8: 'utf8' }, writeAsStringAsync: jest.fn(),
}))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => {}) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }) }))
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-gifted-charts', () => ({ LineChart: 'LineChart' }))
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

describe('Sensor CSV capture', () => {
  let tree: renderer.ReactTestRenderer | undefined
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockFocused = true
    for (const stream of [mockImu, mockPpg, mockTemperature]) {
      for (const method of Object.values(stream)) method.mockResolvedValue(undefined)
    }
    mockTemperature.readMeasurementInterval.mockResolvedValue(60)
  })
  afterEach(async () => {
    await act(async () => { tree?.unmount(); tree = undefined; await settle() })
    jest.useRealTimers()
  })
  const mount = async (Screen: React.ComponentType) => {
    await act(async () => { tree = renderer.create(<Screen />); await settle() })
  }
  const share = async () => {
    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: 'Share CSV' }).props.onPress()
      await settle()
    })
    return jest.mocked(FileSystem.writeAsStringAsync).mock.calls.at(-1)![1]
  }

  it('exports both IMU streams with distinct units and exact integer timestamps', async () => {
    await mount(IMUScreen)
    act(() => {
      mockImu.subscribeAccelerometer.mock.calls[0][0](new AccelerometerSample(18446744073709551615n, 4096, -4096, 0))
      mockImu.subscribeQuaternion.mock.calls[0][0](new QuaternionSample(1000n, 0, 0, 0, 16384, 0))
    })
    const csv = await share()
    expect(csv).toContain('acceleration_x_g,acceleration_y_g,acceleration_z_g,quaternion_x')
    expect(csv).toContain(',18446744073709551615,accelerometer,1,-1,0,')
    expect(csv).toContain(',1000,quaternion,,,,0,0,0,1')
    await act(async () => { tree!.unmount(); tree = undefined; await settle() })
    expect(mockImu.unsubscribe).toHaveBeenCalledTimes(2)
  })

  it('exports every PPG channel and ignores late notifications after blur', async () => {
    await mount(PPGScreen)
    const red = mockPpg.subscribeRed.mock.calls[0][0]
    act(() => {
      red(new PpgSample(18446744073709551615n, 12))
      mockPpg.subscribeInfrared.mock.calls[0][0](new PpgSample(2n, 34))
      mockPpg.subscribeGreen.mock.calls[0][0](new PpgSample(3n, 56))
    })
    await act(async () => { mockFocused = false; tree!.update(<PPGScreen />); await settle() })
    act(() => red(new PpgSample(4n, 999)))
    const csv = await share()
    expect(csv).toContain(',18446744073709551615,red,12')
    expect(csv).toContain(',2,ir,34')
    expect(csv).toContain(',3,green,56')
    expect(csv).not.toContain('999')
    expect(mockPpg.unsubscribe).toHaveBeenCalledTimes(3)
  })

  it('keeps an absent device temperature timestamp blank and supplies host receipt time', async () => {
    await mount(TemperatureScreen)
    act(() => mockTemperature.subscribe.mock.calls[0][0](new TemperatureMeasurement(32.25, null, null, 0)))
    const csv = await share()
    expect(csv).toContain('received_at_utc,device_timestamp_utc,temperature_c,temperature_type,flags')
    expect(csv).toMatch(/1,\d{4}-[^,]+Z,,32.25,,0\r\n/)
  })

  it('waits for an in-flight subscribe to finish before cleanup and refocus', async () => {
    let finish!: () => void
    mockImu.subscribeAccelerometer.mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve }))
    await mount(IMUScreen)
    act(() => { mockFocused = false; tree!.update(<IMUScreen />) })
    act(() => { mockFocused = true; tree!.update(<IMUScreen />) })
    expect(mockImu.setEnabled).toHaveBeenCalledTimes(1)
    await act(async () => { finish(); await settle() })
    expect(mockImu.subscribeQuaternion).toHaveBeenCalledTimes(1)
    expect(mockImu.setEnabled).toHaveBeenCalledTimes(2)
    expect(mockImu.unsubscribe.mock.invocationCallOrder[0])
      .toBeLessThan(mockImu.setEnabled.mock.invocationCallOrder[1])
  })
})
