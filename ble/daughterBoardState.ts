import { decode as b64decode } from 'base-64';
import {
  ACTIVE_DAUGHTER_BOARD_BY_ENUM,
  DAUGHTER_BOARD_MASKS,
  MAIN_BOARD_SENSOR_MODULES,
  SENSOR_TO_DAUGHTER_BOARD,
  type DaughterBoardKey,
  type SensorModuleKey,
} from '@/constants/DaughterBoardConstants';

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

export const DEFAULT_DAUGHTER_BOARD_STATE: DaughterBoardState = {
  connectedMask: 0,
  activeBoardEnum: null,
  activeBoardKey: null,
  activeBoardName: null,
  regulatorMv: 0,
  flags: 0,
  connectedBoards: [],
  connectedBoardNames: [],
  readyModuleCount: MAIN_BOARD_SENSOR_MODULES.length,
};

function base64ToBytes(base64: string) {
  const binary = b64decode(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function parseDaughterBoardState(value: string | null | undefined): DaughterBoardState | null {
  if (!value) {
    return null;
  }
  console.log('Raw daughter board state value (base64):', value);
  const bytes = base64ToBytes(value);
  if (bytes.length < 5) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const connectedMask = view.getUint8(0);
  const activeBoardEnum = view.getUint8(1);
  const regulatorMv = view.getUint16(2, true);
  const flags = view.getUint8(4);
  const connectedBoards = (Object.keys(DAUGHTER_BOARD_MASKS) as DaughterBoardKey[]).filter(
    board => (connectedMask & DAUGHTER_BOARD_MASKS[board]) !== 0
  );
  const activeBoardKey = ACTIVE_DAUGHTER_BOARD_BY_ENUM[activeBoardEnum] ?? null;
  const activeBoardName =
    activeBoardKey && connectedBoards.includes(activeBoardKey) ? activeBoardKey : null;

  return {
    connectedMask,
    activeBoardEnum,
    activeBoardKey,
    activeBoardName,
    regulatorMv,
    flags,
    connectedBoards,
    connectedBoardNames: connectedBoards,
    readyModuleCount: MAIN_BOARD_SENSOR_MODULES.length + connectedBoards.length,
  };
}

export function isSensorModuleAvailable(
  moduleKey: SensorModuleKey,
  daughterBoardState: DaughterBoardState
) {
  if (MAIN_BOARD_SENSOR_MODULES.includes(moduleKey)) {
    return true;
  }

  const board = SENSOR_TO_DAUGHTER_BOARD[moduleKey];
  return board ? daughterBoardState.connectedBoards.includes(board) : false;
}

export function isSensorModuleActive(
  moduleKey: SensorModuleKey,
  daughterBoardState: DaughterBoardState
) {
  if (MAIN_BOARD_SENSOR_MODULES.includes(moduleKey)) {
    return false;
  }

  const board = SENSOR_TO_DAUGHTER_BOARD[moduleKey];
  return board ? daughterBoardState.connectedBoards.includes(board) : false;
}
