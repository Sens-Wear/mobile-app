import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bleManager } from '../ble/bleManager';
import type { Device, Subscription, Characteristic } from 'react-native-ble-plx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '@/constants/StorageKeys';
import { Platform } from 'react-native';

type BleSessionState = {
  deviceId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
};

export function useBleSession() {
  const [state, setState] = useState<BleSessionState>({
    deviceId: null,
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  // Track monitor subscriptions so we can cleanup
  const monitorsRef = useRef<Subscription[]>([]);
  const disconnectSubRef = useRef<Subscription | null>(null);

  const clearMonitors = useCallback(() => {
    monitorsRef.current.forEach(s => {
      try { s.remove(); } catch {}
    });
    monitorsRef.current = [];
  }, []);

  const connect = useCallback(async (deviceId: string) => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Connect
      let device = await bleManager.connectToDevice(deviceId, { timeout: 8000 });

      // Discover once (important)
      await device.discoverAllServicesAndCharacteristics();
      
      // Android only: request larger ATT MTU for bigger notification payloads.
      // Negotiated value depends on peripheral + stack and can be lower than requested.
      if (Platform.OS === 'android') {
        try {
          device = await device.requestMTU(512);
          console.log('Negotiated MTU:', device.mtu);
        } catch (mtuError) {
          console.log('MTU request failed, continuing with default MTU', mtuError);
        }
      }

      // Remove any previous listeners/subscriptions
      clearMonitors();
      disconnectSubRef.current?.remove();

      // Listen for disconnects
      disconnectSubRef.current = bleManager.onDeviceDisconnected(device.id, (error) => {
        // mark disconnected; you can choose to auto-reconnect here if desired
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          deviceId: null,
          error: error ?? null,
        }));
      });

      setState(prev => ({
        ...prev,
        deviceId: device.id,
        isConnected: true,
        isConnecting: false,
      }));

      return device;
    } catch (e: any) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        deviceId: null,
        error: e,
      }));
      return null;
    }
  }, [clearMonitors]);

  const disconnect = useCallback(async () => {
    const id = state.deviceId;
    if (!id) return;

    try {
      clearMonitors();
      disconnectSubRef.current?.remove();
      disconnectSubRef.current = null;

      await bleManager.cancelDeviceConnection(id);
    } finally {
      setState(prev => ({
        ...prev,
        deviceId: null,
        isConnected: false,
        isConnecting: false,
      }));
    }
  }, [state.deviceId, clearMonitors]);

  const getServices = useCallback(async () => {
    if (!state.deviceId) throw new Error('No connected device');
    return bleManager.servicesForDevice(state.deviceId);
  }, [state.deviceId]);

  const getCharacteristics = useCallback(async (serviceUUID: string) => {
    if (!state.deviceId) throw new Error('No connected device');
    return bleManager.characteristicsForDevice(state.deviceId, serviceUUID);
  }, [state.deviceId]);

  const monitor = useCallback((
    serviceUUID: string,
    characteristicUUID: string,
    onUpdate: (c: Characteristic) => void,
    onError?: (e: Error) => void
  ) => {
    if (!state.deviceId) throw new Error('No connected device');

    const sub = bleManager.monitorCharacteristicForDevice(
      state.deviceId,
      serviceUUID,
      characteristicUUID,
      (error, characteristic) => {
        if (error) {
          onError?.(error);
          return;
        }
        if (characteristic) onUpdate(characteristic);
      }
    );

    monitorsRef.current.push(sub);
    return sub;
  }, [state.deviceId]);

  const readCharacteristic = useCallback(async (
    serviceUUID: string,
    characteristicUUID: string
  ) => {
    if (!state.deviceId) throw new Error('No connected device');

    return bleManager.readCharacteristicForDevice(
      state.deviceId,
      serviceUUID,
      characteristicUUID
    );
  }, [state.deviceId]);

  const writeWithResponse = useCallback(async (
    serviceUUID: string,
    characteristicUUID: string,
    base64Value: string
  ) => {
    if (!state.deviceId) throw new Error('No connected device');

    return bleManager.writeCharacteristicWithResponseForDevice(
      state.deviceId,
      serviceUUID,
      characteristicUUID,
      base64Value
    );
  }, [state.deviceId]);

  const writeWithoutResponse = useCallback(async (
    serviceUUID: string,
    characteristicUUID: string,
    base64Value: string
  ) => {
    if (!state.deviceId) throw new Error('No connected device');

    return bleManager.writeCharacteristicWithoutResponseForDevice(
      state.deviceId,
      serviceUUID,
      characteristicUUID,
      base64Value
    );
  }, [state.deviceId]);

  // Cleanup when the component using this hook unmounts
  useEffect(() => {
    return () => {
      clearMonitors();
      disconnectSubRef.current?.remove();
      disconnectSubRef.current = null;
      // Do NOT destroy bleManager here if it is used app-wide
    };
  }, [clearMonitors]);

  const persistPairedId = useCallback(async (id: string) => {
    await AsyncStorage.setItem(STORAGE_KEYS.PAIRED_DEVICE_ID, id);
  }, []);

  const loadPairedId = useCallback(async () => {
    return AsyncStorage.getItem(STORAGE_KEYS.PAIRED_DEVICE_ID);
  }, []);

  const clearPairedId = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.PAIRED_DEVICE_ID);
  }, []);

  const pair = useCallback(async (deviceId: string) => {
    // connect + discover (your existing connect logic)
    const device = await connect(deviceId);

    // persist only after success
    if (!device) {
      return null;
    }

    await persistPairedId(device.id);
    return device;
  }, [connect, persistPairedId]);

  const autoConnect = useCallback(async () => {
    const savedId = await loadPairedId();
    if (!savedId) return null;

    try {
      const device = await connect(savedId);
      return device;
    } catch (e) {
      // Decide policy:
      // If connection fails, you can clear it so user is forced to re-pair.
      await clearPairedId();
      return null;
    }
  }, [connect, loadPairedId, clearPairedId]);

  const forget = useCallback(async () => {
    try {
      await disconnect(); // cancel connection + cleanup
    } finally {
      await clearPairedId();
    }
  }, [disconnect, clearPairedId]);

  return useMemo(() => ({
    ...state,
    connect,
    disconnect,
    getServices,
    getCharacteristics,
    monitor,
    readCharacteristic,
    writeWithResponse,
    writeWithoutResponse,
    pair,
    autoConnect,
    forget,
  }), [
    state,
    connect,
    disconnect,
    getServices,
    getCharacteristics,
    monitor,
    readCharacteristic,
    writeWithResponse,
    writeWithoutResponse,
    pair,
    autoConnect,
    forget,
  ]);
}
