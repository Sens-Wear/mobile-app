import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { POWER_UUIDS } from '@/ble/bleConstants';
import {
  DEFAULT_DAUGHTER_BOARD_STATE,
  parseDaughterBoardState,
} from '@/ble/daughterBoardState';
import { useBle } from './BleSessionProvider';

export function useFocusedDaughterBoardState() {
  const { isConnected, monitor, readCharacteristic } = useBle();
  const [daughterBoardState, setDaughterBoardState] = React.useState(
    DEFAULT_DAUGHTER_BOARD_STATE
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!isConnected) {
        setDaughterBoardState(DEFAULT_DAUGHTER_BOARD_STATE);
        return () => {};
      }

      let isActive = true;

      const handleUpdate = (c: { value: string | null }) => {
        const nextState = parseDaughterBoardState(c.value);
        if (isActive && nextState) {
          setDaughterBoardState(nextState);
        }
      };

      const readInitial = async () => {
        try {
          const characteristic = await readCharacteristic(
            POWER_UUIDS.SERVICE_UUID,
            POWER_UUIDS.DAUGHTER_BOARD_CHAR
          );
          if (isActive && characteristic) {
            handleUpdate(characteristic);
          }
        } catch (error) {
          console.log(error);
        }
      };

      readInitial();

      const subscription = monitor(
        POWER_UUIDS.SERVICE_UUID,
        POWER_UUIDS.DAUGHTER_BOARD_CHAR,
        handleUpdate,
        error => {
          console.log(error);
        }
      );

      return () => {
        isActive = false;
        subscription.remove();
      };
    }, [isConnected, monitor, readCharacteristic])
  );

  React.useEffect(() => {
    if (!isConnected) {
      setDaughterBoardState(DEFAULT_DAUGHTER_BOARD_STATE);
    }
  }, [isConnected]);

  return daughterBoardState;
}
