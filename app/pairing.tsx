import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Platform, PermissionsAndroid } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { bleManager } from '@/ble/bleManager';
import { useBle } from '../hooks/BleSessionProvider';

export default function DevicesScreen() {
  const { pair, isConnecting, error } = useBle();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const router = useRouter();

  const onDeviceFound = (device) => {
    if (!device?.id || (!device?.localName && !device?.name)) return;

    setDevices(prevDevices => {
      // avoid duplicates
      if (prevDevices.some(d => d.id === device.id)) {
        return prevDevices;
      }

      if (prevDevices.length === 0) {
        setLoading(false);
      }

      return [
        ...prevDevices,
        device,
      ];
    });
  };

  useFocusEffect(
    React.useCallback(() => {
      requestBluetoothPermission();
      const subscription = bleManager.onStateChange(state => {
        if (state === 'PoweredOn') {
          scanAndConnect()
          subscription.remove()
        }
      }, true)
      return () => {
        subscription.remove();
        bleManager.stopDeviceScan();
      };
    }, [bleManager])
  );

  function scanAndConnect() {
    bleManager.startDeviceScan(null, null, (error, device) => {
      onDeviceFound(device);
      if (error) {
        // Handle error (scanning will be stopped automatically)
        return
      }
    })
  }

  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'ios') {
      return true
    }
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
      const apiLevel = parseInt(Platform.Version.toString(), 10)

      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        return granted === PermissionsAndroid.RESULTS.GRANTED
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ])

        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
        )
      }
    }

    this.showErrorToast('Permission have not been granted')

    return false
  }

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/'); // or wherever your "home" screen is
    }
  };

  const handleSelectDevice = async (device) => {
    var ret = await pair(device.id);
    if (ret) {
      router.push({ pathname: '/sensors', params: { deviceId: device.id } });
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Pairing a SensWear device</Text>
        </View>

        <View style={styles.headerRight}>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <FlatList
          contentContainerStyle={styles.deviceListContentContainerStyle}
          data={devices}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.deviceItem} onPress={() => handleSelectDevice(item)}>
              <Text style={styles.deviceName}>{item.name ?? item.localName ?? 'Unknown'}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerLeft: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  deviceItem: {
    backgroundColor: '#f1f1f1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '500',
  },
  deviceListContentContainerStyle: {
    paddingHorizontal: 10,
    paddingTop: 10
  },
});