import type { DeviceCapabilities } from 'senswear'
import {
  AVAILABLE_DAUGHTER_BOARDS,
  DAUGHTER_BOARD_FLAGS,
  SENSOR_FEATURES,
  SENSOR_TO_DAUGHTER_BOARD,
  type DaughterBoardKey,
  type SensorModuleKey,
} from '@/constants/DaughterBoardConstants';

export type DaughterBoardState = {
  firmwareBoards: DaughterBoardKey[];
  availableModules: SensorModuleKey[];
  readyModuleCount: number;
};

export function daughterBoardStateFromCapabilities(
  capabilities: DeviceCapabilities | null,
  isConnected: boolean
): DaughterBoardState {
  if (!isConnected || !capabilities) {
    return { firmwareBoards: [], availableModules: [], readyModuleCount: 0 }
  }
  const firmwareBoards = AVAILABLE_DAUGHTER_BOARDS.filter(
    (board) => capabilities.hasShield(DAUGHTER_BOARD_FLAGS[board])
  )
  const availableModules = (Object.keys(SENSOR_FEATURES) as SensorModuleKey[]).filter((key) => {
    const board = SENSOR_TO_DAUGHTER_BOARD[key]
    return capabilities.hasFeature(SENSOR_FEATURES[key]) && (!board || firmwareBoards.includes(board))
  })
  return { firmwareBoards, availableModules, readyModuleCount: availableModules.length }
}

export function isSensorModuleAvailable(
  moduleKey: SensorModuleKey,
  state: DaughterBoardState
) {
  return state.availableModules.includes(moduleKey);
}

export function isSensorModuleActive(
  moduleKey: SensorModuleKey,
  state: DaughterBoardState
) {
  return Boolean(SENSOR_TO_DAUGHTER_BOARD[moduleKey]) && isSensorModuleAvailable(moduleKey, state);
}
