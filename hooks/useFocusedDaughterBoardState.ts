import { useMemo } from 'react';

import { daughterBoardStateFromCapabilities } from '@/ble/daughterBoardState';
import { useBle } from './BleSessionProvider';

export function useFocusedDaughterBoardState() {
  const { isConnected, capabilities } = useBle();
  return useMemo(
    () => daughterBoardStateFromCapabilities(capabilities, isConnected),
    [capabilities, isConnected]
  );
}
