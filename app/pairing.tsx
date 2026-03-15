import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { bleManager } from '@/ble/bleManager';
import { useBle } from '../hooks/BleSessionProvider';

export default function DevicesScreen() {
  const { pair, error } = useBle();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPairing, setIsPairing] = useState(false);
  const navigation = useNavigation();
  const router = useRouter();

  const onDeviceFound = (device) => {
    if (!device?.id || (!device?.localName && !device?.name)) return;

    setDevices((prevDevices) => {
      if (prevDevices.some((d) => d.id === device.id)) {
        return prevDevices;
      }

      if (prevDevices.length === 0) {
        setLoading(false);
      }

      return [...prevDevices, device];
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      requestBluetoothPermission();
      const subscription = bleManager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          scanAndConnect();
          subscription.remove();
        }
      }, true);
      return () => {
        subscription.remove();
        bleManager.stopDeviceScan();
      };
    }, [bleManager])
  );

  function scanAndConnect() {
    bleManager.startDeviceScan(null, null, (scanError, device) => {
      onDeviceFound(device);
      if (scanError) {
        return;
      }
    });
  }

  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'ios') {
      return true;
    }
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
      const apiLevel = parseInt(Platform.Version.toString(), 10);

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);

        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
        );
      }
    }

    this.showErrorToast('Permission have not been granted');

    return false;
  };

  const handleSelectDevice = async (device) => {
    setIsPairing(true);
    const ret = await pair(device.id);
    if (ret) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: '(tabs)' as never,
            params: { screen: 'sensors', params: { deviceId: device.id } },
          } as never,
        ],
      });
      return;
    }
    setIsPairing(false);
  };

  useEffect(() => {
    if (error) {
      setIsPairing(false);
    }
  }, [error]);

  return (
    <View style={styles.container}>
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#153B2E', '#356B59', '#D7C1A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                  <Ionicons name="chevron-back" size={20} color="#F7F0E8" />
                </TouchableOpacity>

                <View style={styles.heroIconWrap}>
                  <Ionicons name="bluetooth-outline" size={20} color="#153B2E" />
                </View>
              </View>

              <Text style={styles.eyebrow}>Device pairing</Text>
              <Text style={styles.heroTitle}>Find a SensWear device and connect in one step.</Text>
              <Text style={styles.heroSubtitle}>
                Nearby devices appear below as scanning runs in the background. Tap one card to pair
                and continue to the sensor dashboard.
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.metaPill}>
                  <Ionicons name="search-outline" size={15} color="#153B2E" />
                  <Text style={styles.metaPillText}>{loading ? 'Scanning now' : 'Scan active'}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Ionicons name="hardware-chip-outline" size={15} color="#153B2E" />
                  <Text style={styles.metaPillText}>{devices.length} devices found</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Detected devices</Text>
                <Text style={styles.summaryValue}>{devices.length}</Text>
                <Text style={styles.summaryHint}>Unique BLE devices with a visible name.</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Pairing state</Text>
                <Text style={styles.summaryValue}>{isPairing ? 'Connecting' : loading ? 'Searching' : 'Ready'}</Text>
                <Text style={styles.summaryHint}>Tap a device card to start the connection flow.</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Available devices</Text>
              <Text style={styles.sectionCaption}>Select one device to continue into the app.</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#153B2E" />
              <Text style={styles.loadingTitle}>Scanning for nearby devices</Text>
              <Text style={styles.loadingText}>Stay close to the hardware while Bluetooth discovery runs.</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bluetooth-outline" size={22} color="#153B2E" />
              </View>
              <Text style={styles.emptyTitle}>No devices found yet</Text>
              <Text style={styles.emptyText}>
                Make sure the target device is powered on and advertising, then wait for the scan to pick it up.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.deviceItem} onPress={() => handleSelectDevice(item)}>
            <View style={styles.deviceIconWrap}>
              <Ionicons name="watch-outline" size={20} color="#153B2E" />
            </View>
            <View style={styles.deviceTextWrap}>
              <Text style={styles.deviceName}>{item.name ?? item.localName ?? 'Unknown'}</Text>
              <Text style={styles.deviceId}>{item.id}</Text>
            </View>
            <View style={styles.deviceAction}>
              <Ionicons name="chevron-forward" size={18} color="#153B2E" />
            </View>
          </TouchableOpacity>
        )}
      />

      {isPairing && (
        <View style={styles.pairingOverlay}>
          <View style={styles.pairingCard}>
            <ActivityIndicator size="large" color="#F7F0E8" />
            <Text style={styles.pairingTitle}>Connecting to device</Text>
            <Text style={styles.pairingText}>The pairing flow is in progress. This may take a moment.</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE8',
    paddingTop: 50,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    shadowColor: '#153B2E',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E3D2',
  },
  eyebrow: {
    color: '#F6ECE0',
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FDF9F4',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    maxWidth: '92%',
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#F3E8DD',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    maxWidth: '92%',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1E3D2',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  metaPillText: {
    color: '#153B2E',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFF9F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 16,
  },
  summaryLabel: {
    color: '#68736D',
    fontSize: 12,
  },
  summaryValue: {
    color: '#14251F',
    fontSize: 19,
    fontWeight: '800',
    marginTop: 8,
  },
  summaryHint: {
    color: '#5F6B65',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14251F',
  },
  sectionCaption: {
    marginTop: 4,
    color: '#5F6B65',
    fontSize: 14,
  },
  loadingCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    paddingHorizontal: 18,
    paddingVertical: 26,
    alignItems: 'center',
  },
  loadingTitle: {
    color: '#14251F',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 14,
  },
  loadingText: {
    color: '#5F6B65',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 22,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E6F0EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#14251F',
    fontSize: 20,
    fontWeight: '800',
  },
  emptyText: {
    color: '#5F6B65',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  deviceItem: {
    marginTop: 14,
    backgroundColor: '#FFF9F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#E6F0EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceTextWrap: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14251F',
  },
  deviceId: {
    marginTop: 4,
    color: '#68736D',
    fontSize: 12,
  },
  deviceAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E3D2',
  },
  pairingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 37, 31, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pairingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#153B2E',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  pairingTitle: {
    color: '#FDF9F4',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  pairingText: {
    color: '#D8E1DB',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
});
