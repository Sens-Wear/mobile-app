import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Subscription } from 'react-native-ble-plx';
import { SenswearClient, type DiscoveredDevice } from 'senswear';

import { bleManager } from '../ble/bleManager';
import { STORAGE_KEYS } from '@/constants/StorageKeys';

type BleSessionState = {
  deviceId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isReconnecting: boolean;
  error: Error | null;
};

const RECONNECT_DELAY_MS = 2_000;

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function isOperationCancelled(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const error = value as { errorCode?: unknown; message?: unknown };
  return error.errorCode === 2 || error.message === 'Operation was cancelled';
}

export function useBleSession() {
  const [state, setState] = useState<BleSessionState>({
    deviceId: null,
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    error: null,
  });
  const [client, setClient] = useState<SenswearClient | null>(null);
  const clientRef = useRef<SenswearClient | null>(null);
  const disconnectSubRef = useRef<Subscription | null>(null);
  const reconnectTargetRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectEnabledRef = useRef(false);
  const persistAfterConnectRef = useRef(false);

  const discover = useCallback(async (timeoutMs = 5_000): Promise<DiscoveredDevice[]> => {
    return SenswearClient.discover({
      manager: bleManager,
      timeoutMs,
      namePrefixes: ['Sens Wear', 'SensWear', 'SenseWear'],
    });
  }, []);

  const persistPairedId = useCallback(
    (id: string) => AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICE_ID, id),
    []
  );
  const loadPairedId = useCallback(
    () => AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICE_ID),
    []
  );
  const clearPairedId = useCallback(
    () => AsyncStorage.removeItem(STORAGE_KEYS.PAIRED_DEVICE_ID),
    []
  );

  const connect = useCallback(async (deviceId: string, isReconnect = false) => {
    reconnectEnabledRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectTargetRef.current = deviceId;
    setState((previous) => ({
      ...previous,
      deviceId,
      isConnecting: true,
      isReconnecting: isReconnect,
      error: isReconnect ? previous.error : null,
    }));
    try {
      disconnectSubRef.current?.remove();
      disconnectSubRef.current = null;
      if (clientRef.current) {
        await clientRef.current.disconnect();
      }

      const nextClient = new SenswearClient(deviceId, {
        manager: bleManager,
        timeoutMs: 8_000,
        waitForPoweredOn: true,
        connectionOptions: {
          requestMTU: 247,
        },
        onNotificationError(error, characteristicUuid) {
          if (isOperationCancelled(error)) return;
          console.error(`SensWear notification error on ${characteristicUuid}`, error);
          if (!reconnectEnabledRef.current) return;
          setClient(null);
          setState({
            deviceId,
            isConnected: false,
            isConnecting: false,
            isReconnecting: true,
            error: asError(error),
          });
        },
      });
      await nextClient.connect();
      clientRef.current = nextClient;
      setClient(nextClient);

      disconnectSubRef.current = bleManager.onDeviceDisconnected(deviceId, (error) => {
        clientRef.current = null;
        setClient(null);
        if (!reconnectEnabledRef.current) return;
        setState({
          deviceId,
          isConnected: false,
          isConnecting: false,
          isReconnecting: true,
          error: error ?? new Error('The BLE connection was lost.'),
        });
      });

      if (persistAfterConnectRef.current) {
        persistAfterConnectRef.current = false;
        try {
          await persistPairedId(deviceId);
        } catch (error) {
          console.error('Failed to save the paired SensWear device', error);
        }
      }
      setState({
        deviceId,
        isConnected: true,
        isConnecting: false,
        isReconnecting: false,
        error: null,
      });
      return nextClient;
    } catch (error) {
      const normalized = asError(error);
      clientRef.current = null;
      setClient(null);
      setState({
        deviceId,
        isConnected: false,
        isConnecting: false,
        isReconnecting: reconnectEnabledRef.current,
        error: normalized,
      });
      return null;
    }
  }, [persistPairedId]);

  useEffect(() => {
    if (!state.isReconnecting || state.isConnecting || !reconnectEnabledRef.current) return;
    const deviceId = reconnectTargetRef.current;
    if (!deviceId || reconnectTimerRef.current) return;

    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      if (reconnectEnabledRef.current) {
        void connect(deviceId, true);
      }
    }, RECONNECT_DELAY_MS);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect, state.isConnecting, state.isReconnecting, state.error]);

  const disconnect = useCallback(async () => {
    reconnectEnabledRef.current = false;
    reconnectTargetRef.current = null;
    persistAfterConnectRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    const current = clientRef.current;
    clientRef.current = null;
    setClient(null);
    try {
      await current?.disconnect();
    } finally {
      setState((previous) => ({
        ...previous,
        deviceId: null,
        isConnected: false,
        isConnecting: false,
        isReconnecting: false,
        error: null,
      }));
    }
  }, []);

  const pair = useCallback(async (deviceId: string) => {
    reconnectEnabledRef.current = true;
    persistAfterConnectRef.current = true;
    const connected = await connect(deviceId);
    return connected;
  }, [connect]);

  const autoConnect = useCallback(async () => {
    const savedId = await loadPairedId();
    if (!savedId) return null;
    reconnectEnabledRef.current = true;
    return connect(savedId);
  }, [connect, loadPairedId]);

  const forget = useCallback(async () => {
    try {
      await disconnect();
    } finally {
      await clearPairedId();
    }
  }, [clearPairedId, disconnect]);

  useEffect(() => () => {
    reconnectEnabledRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    disconnectSubRef.current?.remove();
    void clientRef.current?.disconnect();
  }, []);

  return useMemo(() => ({
    ...state,
    client,
    discover,
    connect,
    disconnect,
    pair,
    autoConnect,
    forget,
  }), [state, client, discover, connect, disconnect, pair, autoConnect, forget]);
}
