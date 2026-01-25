import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Progress from 'react-native-progress';
import { decode as b64decode } from 'base-64';
import { useBle } from '@/hooks/BleSessionProvider';
import { POWER_UUIDS } from '@/ble/bleConstants';

const sensors = [
  { id: '1', name: 'PPG', icon: require('@/assets/images/dashboard_icons/heart_rate.png'), link: '/ppg' },
  { id: '2', name: 'IMU', icon: require('@/assets/images/dashboard_icons/imu.png'), link: '/imu' },
  { id: '3', name: 'Temperature', icon: require('@/assets/images/dashboard_icons/temperature.png'), link: '/temperature' },
  { id: '4', name: 'Touch', icon: require('@/assets/images/dashboard_icons/touch.png'), link: '/touch' },
  { id: '5', name: 'LED', icon: require('@/assets/images/dashboard_icons/led.png'), link: '/led' },
  { id: '6', name: 'Vibration', icon: require('@/assets/images/dashboard_icons/vibration.png'), link: '/vibration' },
];

export default function SensorsScreen() {
  const [gaugeInfo, setGaugeInfo] = useState({
    state_of_charge_cdec: -1,
  });
  const [chargerInfo, setChargerInfo] = useState({
          bCharging: false,
  });
  const { monitor, readCharacteristic, isConnected } = useBle();
  const router = useRouter();
  function base64ToBytes(base64: string) {
    const binary = b64decode(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const batteryStatusColors = () => {
    if (chargerInfo.bCharging) {
      return 'rgba(0, 14, 213, 1)';
    }
    if (gaugeInfo.state_of_charge_cdec < 300) {
      return 'rgba(122, 0, 0, 1)';
    }
    return 'rgba(0, 122, 59, 1)';
  };

  const progressFunction = (progress) => {
    if (chargerInfo.bCharging) {
      return `⚡︎`;
    }
    return Math.floor(progress * 100) + '%';
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!isConnected) {
        return () => {};
      }

      let isChargerActive = true;
      let isGaugeActive = true;
      const handleChargerUpdate = (c: { value: string | null }) => {
        const v = c.value;
        if (!v) return;
        const bytes = base64ToBytes(v);
        if (bytes.length < 4) return;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const flags = view.getUint32(0, true);
        setChargerInfo({
          bCharging: !!(flags & (1 << 6)),
        });
      };

      const readChargerInitial = async () => {
        try {
          const c = await readCharacteristic(POWER_UUIDS.SERVICE_UUID, POWER_UUIDS.CHARGER_CHAR);
          if (isChargerActive && c) handleChargerUpdate(c);
        } catch (e) {
          console.log(e);
        }
      };

      readChargerInitial();

      const chargerSub = monitor(
        POWER_UUIDS.SERVICE_UUID,
        POWER_UUIDS.CHARGER_CHAR,
        handleChargerUpdate,
        (e) => {
          console.log(e);
        }
      );

      const handleGaugeUpdate = (c: { value: string | null }) => {
        const v = c.value;
        if (!v) return;
        const bytes = base64ToBytes(v);
        if (bytes.length < 16) return null;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let o = 0;

        const i16 = () => { const v = view.getInt16(o, true); o += 2; return v; };
        const u16 = () => { const v = view.getUint16(o, true); o += 2; return v; };
        const temperature_cdec = i16();
        const voltage_mv = u16();
        const average_current_ma = i16();
        const average_power_mw = i16();
        const state_of_charge_cdec = u16();
        const nominal_available_capacity_mah = u16();
        const full_battery_capacity_mah = u16();
        const remaining_capacity_mah = u16();
        setGaugeInfo({
          state_of_charge_cdec,
        });
      };

      const readGaugeInitial = async () => {
        try {
          const c = await readCharacteristic(POWER_UUIDS.SERVICE_UUID, POWER_UUIDS.GAUGE_CHAR);
          if (isGaugeActive && c) handleGaugeUpdate(c);
        } catch (e) {
          console.log(e);
        }
      };

      readGaugeInitial();

      const gaugeSub = monitor(
        POWER_UUIDS.SERVICE_UUID,
        POWER_UUIDS.GAUGE_CHAR,
        handleGaugeUpdate,
        (e) => {
          console.log(e);
        }
      );

      return () => {
        isChargerActive = false;
        isGaugeActive = false;
        chargerSub.remove();
        gaugeSub.remove();
      };
    }, [isConnected, monitor, readCharacteristic])
  );

  const handleSelectSensor = (pathName) => {
    router.push({ pathname: pathName });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}></View>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.headerRight}>
          <Progress.Circle
            size={30}
            indeterminate={false}
            progress={gaugeInfo.state_of_charge_cdec / 1000}
            textStyle={{fontSize: chargerInfo.bCharging ? 15 : 9}}
            showsText={true}
            thickness={2}
            color={batteryStatusColors()}
            formatText= {progressFunction}
          />
        </View>
      </View>

      {/* Sensor List */}
      <FlatList
        data={sensors}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.sensorList}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.sensorItem} onPress={() => handleSelectSensor(item.link)}>
            <Image source={item.icon} style={styles.logo} resizeMode="contain" />
            <Text style={styles.sensorName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 30,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'flex-end',
  },
  batteryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sensorList: {
    padding: 20,
  },
  sensorItem: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  sensorName: {
    fontSize: 16,
    fontWeight: '500',
  },
});
