import { useMemo } from 'react';

import type { DaughterBoardState } from '@/ble/daughterBoardState';
import { useBle } from './BleSessionProvider';

const AVAILABLE_STATE: DaughterBoardState = {
  connectedMask: 0x0f,
  activeBoardEnum: null,
  activeBoardKey: null,
  activeBoardName: null,
  regulatorMv: 0,
  flags: 0,
  connectedBoards: ['PPG', 'Temperature', 'Touch', 'Haptic'],
  connectedBoardNames: ['PPG', 'Temperature', 'Touch', 'Haptic'],
  readyModuleCount: 6,
};

const DISCONNECTED_STATE: DaughterBoardState = {
  ...AVAILABLE_STATE,
  connectedMask: 0,
  connectedBoards: [],
  connectedBoardNames: [],
  readyModuleCount: 0,
};

/**
 * The current firmware no longer publishes the legacy daughter-board status characteristic.
 * Capability is represented by the SDK modules; while connected, all advertised app modules
 * are made available and an individual operation reports a GATT error if hardware is absent.
 */
export function useFocusedDaughterBoardState() {
  const { isConnected } = useBle();
  return useMemo(() => isConnected ? AVAILABLE_STATE : DISCONNECTED_STATE, [isConnected]);
}
