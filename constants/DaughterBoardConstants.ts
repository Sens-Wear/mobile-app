export type DaughterBoardKey = 'PPG' | 'Temperature' | 'Touch' | 'Haptic';

export type SensorModuleKey =
  | 'PPG'
  | 'IMU'
  | 'Temperature'
  | 'Touch'
  | 'LED'
  | 'Vibration';

export const MAIN_BOARD_SENSOR_MODULES: SensorModuleKey[] = ['IMU', 'LED'];

export const DAUGHTER_BOARD_MASKS: Record<DaughterBoardKey, number> = {
  PPG: 1 << 0,
  Temperature: 1 << 1,
  Touch: 1 << 2,
  Haptic: 1 << 3,
};

export const ACTIVE_DAUGHTER_BOARD_BY_ENUM: Record<number, DaughterBoardKey> = {
  0: 'PPG',
  1: 'Temperature',
  2: 'Touch',
  3: 'Haptic',
};

export const SENSOR_TO_DAUGHTER_BOARD: Partial<Record<SensorModuleKey, DaughterBoardKey>> = {
  PPG: 'PPG',
  Temperature: 'Temperature',
  Touch: 'Touch',
  Vibration: 'Haptic',
};
