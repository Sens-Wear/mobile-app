import { DaughterBoard, DeviceCapabilities, DeviceFeature } from 'senswear'
import { daughterBoardStateFromCapabilities, isSensorModuleAvailable } from '../daughterBoardState'

describe('firmware module availability', () => {
  it('disables everything when disconnected or metadata is missing', () => {
    const capabilities = new DeviceCapabilities(1, 15, 255)
    expect(daughterBoardStateFromCapabilities(capabilities, false).availableModules).toEqual([])
    expect(daughterBoardStateFromCapabilities(null, true).availableModules).toEqual([])
  })

  it.each([
    [0, DeviceFeature.Imu | DeviceFeature.Led, ['IMU', 'LED']],
    [DaughterBoard.Touch, DeviceFeature.Touch, ['Touch']],
    [DaughterBoard.Haptic, DeviceFeature.Haptic, ['Vibration']],
    [DaughterBoard.Temperature, DeviceFeature.Temperature, ['Temperature']],
    [DaughterBoard.Ppg | DaughterBoard.Temperature, DeviceFeature.Ppg | DeviceFeature.Temperature, ['PPG', 'Temperature']],
  ])('uses shields %i and feature flags %i', (shields, features, expected) => {
    const state = daughterBoardStateFromCapabilities(new DeviceCapabilities(1, shields, features), true)
    expect(state.availableModules).toEqual(expected)
    expect(state.readyModuleCount).toBe(expected.length)
  })

  it('requires producer support as well as the shield and ignores unknown flags', () => {
    const state = daughterBoardStateFromCapabilities(new DeviceCapabilities(1, 0x80000008, 0x80000008), true)
    expect(state.firmwareBoards).toEqual(['Touch'])
    expect(isSensorModuleAvailable('Touch', state)).toBe(false)
    expect(isSensorModuleAvailable('PPG', state)).toBe(false)
  })
})
