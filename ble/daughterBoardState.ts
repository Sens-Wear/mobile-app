import {
  MAIN_BOARD_SENSOR_MODULES,
  SENSOR_TO_DAUGHTER_BOARD,
  type DaughterBoardKey,
  type SensorModuleKey,
} from '@/constants/DaughterBoardConstants';

/**
 * UI capability state. The legacy firmware daughter-board GATT record was removed; this
 * structure now represents which SDK-backed modules the connected product exposes.
 */
export type DaughterBoardState = {
  connectedMask: number;
  activeBoardEnum: number | null;
  activeBoardKey: DaughterBoardKey | null;
  activeBoardName: string | null;
  regulatorMv: number;
  flags: number;
  connectedBoards: DaughterBoardKey[];
  connectedBoardNames: string[];
  readyModuleCount: number;
};

export function isSensorModuleAvailable(
  moduleKey: SensorModuleKey,
  state: DaughterBoardState
) {
  if (MAIN_BOARD_SENSOR_MODULES.includes(moduleKey)) return true;
  const board = SENSOR_TO_DAUGHTER_BOARD[moduleKey];
  return board ? state.connectedBoards.includes(board) : false;
}

export function isSensorModuleActive(
  moduleKey: SensorModuleKey,
  state: DaughterBoardState
) {
  const board = SENSOR_TO_DAUGHTER_BOARD[moduleKey];
  return board ? state.connectedBoards.includes(board) : false;
}
