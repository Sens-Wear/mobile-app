import { DaughterBoard, DeviceFeature } from 'senswear'

export type DaughterBoardKey = 'PPG' | 'Temperature' | 'Touch' | 'Haptic';

export type SensorModuleKey =
  | 'PPG'
  | 'IMU'
  | 'Temperature'
  | 'Touch'
  | 'LED'
  | 'Vibration';

// Product catalog, independent of the firmware currently connected.
export const AVAILABLE_DAUGHTER_BOARDS: readonly DaughterBoardKey[] = [
  'PPG', 'Temperature', 'Touch', 'Haptic',
]

export const DAUGHTER_BOARD_FLAGS: Record<DaughterBoardKey, DaughterBoard> = {
  PPG: DaughterBoard.Ppg,
  Temperature: DaughterBoard.Temperature,
  Touch: DaughterBoard.Touch,
  Haptic: DaughterBoard.Haptic,
}

export const SENSOR_FEATURES: Record<SensorModuleKey, DeviceFeature> = {
  IMU: DeviceFeature.Imu,
  LED: DeviceFeature.Led,
  PPG: DeviceFeature.Ppg,
  Temperature: DeviceFeature.Temperature,
  Touch: DeviceFeature.Touch,
  Vibration: DeviceFeature.Haptic,
}

export const SENSOR_TO_DAUGHTER_BOARD: Partial<Record<SensorModuleKey, DaughterBoardKey>> = {
  PPG: 'PPG',
  Temperature: 'Temperature',
  Touch: 'Touch',
  Vibration: 'Haptic',
};
