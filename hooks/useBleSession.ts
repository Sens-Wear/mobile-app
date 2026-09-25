import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Subscription } from 'react-native-ble-plx';
import { SenswearClient, type DiscoveredDevice } from 'senswear';

import { bleManager } from '../ble/bleManager';
import { STORAGE_KEYS } from '@/constants/StorageKeys';
import { useDeviceMetadata } from './useDeviceMetadata';

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
  const metadata = useDeviceMetadata(client, state.isConnected);
  const clientRef = useRef<SenswearClient | null>(null);
  const disconnectSubRef = useRef<Subscription | null>(null);
  const reconnectTargetRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectEnabledRef = useRef(false);
  const persistTargetRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  // BLE cancellation is device-wide in the shared manager. Finish stale cleanup
  // before another attempt can connect to the same peripheral.
  const connectWorkRef = useRef<Promise<void>>(Promise.resolve());
  const persistenceWorkRef = useRef<Promise<void>>(Promise.resolve());

  const discover = useCallback(async (timeoutMs = 5_000): Promise<DiscoveredDevice[]> => {
    return SenswearClient.discover({
      manager: bleManager,
      timeoutMs,
      namePrefixes: ['Sens Wear', 'SensWear'],
    });
  }, []);

  const queuePersistence = useCallback((operation: () => Promise<void>) => {
    const work = persistenceWorkRef.current.catch(() => {}).then(operation);
    persistenceWorkRef.current = work;
    return work;
  }, []);
  const persistPairedId = useCallback((id: string, generation: number) =>
    queuePersistence(async () => {
      if (generationRef.current === generation && reconnectEnabledRef.current) {
        await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICE_ID, id);
      }
    }), [queuePersistence]);
  const loadPairedId = useCallback(
    () => AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICE_ID),
    []
  );
  const clearPairedId = useCallback(
    () => queuePersistence(() => AsyncStorage.removeItem(STORAGE_KEYS.PAIRED_DEVICE_ID)),
    [queuePersistence]
  );

  const connect = useCallback(async (deviceId: string, isReconnect = false) => {
    const generation = ++generationRef.current;
    const isCurrent = () => generationRef.current === generation && reconnectEnabledRef.current;
    reconnectEnabledRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectTargetRef.current = deviceId;
    if (persistTargetRef.current !== deviceId) persistTargetRef.current = null;
    const previousClient = clientRef.current;
    clientRef.current = null;
    setClient(null);
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    setState((previous) => ({
      ...previous,
      deviceId,
      isConnected: false,
      isConnecting: true,
      isReconnecting: isReconnect,
      error: isReconnect ? previous.error : null,
    }));
    const previousWork = connectWorkRef.current;
    let finishWork!: () => void;
    connectWorkRef.current = new Promise<void>((resolve) => { finishWork = resolve; });
    let nextClient: SenswearClient | null = null;
    let released = false;
    const releaseNextClient = async () => {
      if (!nextClient || released) return;
      released = true;
      try {
        await nextClient.disconnect();
      } catch (error) {
        console.error('Failed to clean up a SensWear connection attempt', error);
      }
    };
    try {
      await previousWork;
      await previousClient?.disconnect();
      if (!isCurrent()) return null;

      nextClient = new SenswearClient(deviceId, {
        manager: bleManager,
        timeoutMs: 8_000,
        waitForPoweredOn: true,
        connectionOptions: {
          requestMTU: 247,
        },
        onNotificationError(error, characteristicUuid) {
          if (isOperationCancelled(error) || !isCurrent() || clientRef.current !== nextClient) return;
          console.error(`SensWear notification error on ${characteristicUuid}`, error);
          generationRef.current += 1;
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
      if (!isCurrent()) {
        await releaseNextClient();
        return null;
      }
      clientRef.current = nextClient;
      setClient(nextClient);

      disconnectSubRef.current = bleManager.onDeviceDisconnected(deviceId, (error) => {
        if (!isCurrent() || clientRef.current !== nextClient) return;
        generationRef.current += 1;
        clientRef.current = null;
        setClient(null);
        setState({
          deviceId,
          isConnected: false,
          isConnecting: false,
          isReconnecting: true,
          error: error ?? new Error('The BLE connection was lost.'),
        });
      });

      if (persistTargetRef.current === deviceId) {
        try {
          await persistPairedId(deviceId, generation);
          if (isCurrent() && persistTargetRef.current === deviceId) persistTargetRef.current = null;
        } catch (error) {
          console.error('Failed to save the paired SensWear device', error);
        }
      }
      if (!isCurrent()) {
        await releaseNextClient();
        return null;
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
      await releaseNextClient();
      if (!isCurrent()) return null;
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
    } finally {
      finishWork();
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
    generationRef.current += 1;
    reconnectEnabledRef.current = false;
    reconnectTargetRef.current = null;
    persistTargetRef.current = null;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    disconnectSubRef.current?.remove();
    disconnectSubRef.current = null;
    const current = clientRef.current;
    clientRef.current = null;
    setClient(null);
    setState({
      deviceId: null,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      error: null,
    });
    // A later attempt waits for this device-wide cancellation to finish.
    const work = connectWorkRef.current.then(() => current?.disconnect());
    connectWorkRef.current = work.then(() => {}, () => {});
    await work;
  }, []);

  const pair = useCallback(async (deviceId: string) => {
    reconnectEnabledRef.current = true;
    persistTargetRef.current = deviceId;
    const connected = await connect(deviceId);
    return connected;
  }, [connect]);

  const autoConnect = useCallback(async () => {
    const generation = generationRef.current;
    const savedId = await loadPairedId();
    if (!savedId || generation !== generationRef.current) return null;
    reconnectEnabledRef.current = true;
    return connect(savedId);
  }, [connect, loadPairedId]);

  const forget = useCallback(async () => {
    const disconnectWork = disconnect();
    // Queue removal immediately: a new pair must be written after this removal,
    // even if closing the old physical connection takes longer.
    const clearWork = clearPairedId();
    await Promise.all([disconnectWork, clearWork]);
  }, [clearPairedId, disconnect]);

  useEffect(() => () => {
    generationRef.current += 1;
    reconnectEnabledRef.current = false;
    persistTargetRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    disconnectSubRef.current?.remove();
    void clientRef.current?.disconnect();
  }, []);

  return useMemo(() => ({
    ...state,
    ...metadata,
    client,
    discover,
    connect,
    disconnect,
    pair,
    autoConnect,
    forget,
  }), [state, metadata, client, discover, connect, disconnect, pair, autoConnect, forget]);
}
