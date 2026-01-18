import React, { useState } from 'react';
import { Alert, StyleSheet, Image, Pressable, View, } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { decode as b64decode } from 'base-64';
import { ExternalLink } from '@/components/ExternalLink';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useBle } from '@/hooks/BleSessionProvider';
import { POWER_UUIDS } from '@/ble/bleConstants';

export default function TabTwoScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [gaugeInfo, setGaugeInfo] = useState({
    temperature_cdec: -1,
    voltage_mv: -1,
    average_current_ma: -1,
    average_power_mw: -1,
    state_of_charge_cdec: -1,
    nominal_available_capacity_mah: -1,
    full_battery_capacity_mah: -1,
    remaining_capacity_mah: -1,
  });
  const [chargerInfo, setChargerInfo] = useState({
          bButtonPressed: false,
          bWake1: false,
          bWake2: false,
          bShipmentMode: false,
          bShutdownMode: false,
          bPowerGood: false,
          bCharging: false,
          bCharged: false,
          bThermalRegulation: false,
          bBatteryUVLO: false,
          bThermalNormal: false,
          bThermalWarmOrHot: false,
          bThermalWarm: false,
          bThermalCool: false,
          bSafetyTimerFault: false,
          bThermalSystemFault: false,
          bBatteryUVLOFault: false,
          bBatteryOCPFault: false,
        });
  const { forget, monitor, readCharacteristic, isConnected } = useBle();

  function base64ToBytes(base64: string) {
      const binary = b64decode(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
  
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
          bButtonPressed: !!(flags & (1 << 0)),
          bWake1: !!(flags & (1 << 1)),
          bWake2: !!(flags & (1 << 2)),
          bShipmentMode: !!(flags & (1 << 3)),
          bShutdownMode: !!(flags & (1 << 4)),
          bPowerGood: !!(flags & (1 << 5)),
          bCharging: !!(flags & (1 << 6)),
          bCharged: !!(flags & (1 << 7)),
          bThermalRegulation: !!(flags & (1 << 8)),
          bBatteryUVLO: !!(flags & (1 << 9)),
          bThermalNormal: !!(flags & (1 << 10)),
          bThermalWarmOrHot: !!(flags & (1 << 11)),
          bThermalWarm: !!(flags & (1 << 12)),
          bThermalCool: !!(flags & (1 << 13)),
          bSafetyTimerFault: !!(flags & (1 << 14)),
          bThermalSystemFault: !!(flags & (1 << 15)),
          bBatteryUVLOFault: !!(flags & (1 << 16)),
          bBatteryOCPFault: !!(flags & (1 << 17)),
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
          temperature_cdec,
          voltage_mv,
          average_current_ma,
          average_power_mw,
          state_of_charge_cdec,
          nominal_available_capacity_mah,
          full_battery_capacity_mah,
          remaining_capacity_mah,
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

  const handleUnpairPress = () => {
    Alert.alert(
      'Unpair device',
      'Are you sure you want to unpair this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unpair',
          style: 'destructive',
          onPress: async () => {
            await forget();
            const parentNavigation = navigation.getParent();
            if (parentNavigation) {
              parentNavigation.reset({
                index: 0,
                routes: [{ name: 'index' as never }],
              });
            } else {
              router.replace('/');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <Image
          source={require('@/assets/images/setting-header.png')}
          style={styles.headerImage}
          resizeMode="contain"
        />
      }>
      <ThemedView style={styles.list}>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Charging status</ThemedText>
          <ThemedText style={styles.valueText}>
            {chargerInfo.bCharged
              ? 'Charged'
              : chargerInfo.bCharging
                ? 'Charging'
                : 'Not connected to power source'}
          </ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Battery percentage</ThemedText>
          <ThemedText style={styles.valueText}>
            {Math.floor(gaugeInfo.state_of_charge_cdec / 10)}%
          </ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Battery capacity</ThemedText>
          <ThemedText style={styles.valueText}>{gaugeInfo.full_battery_capacity_mah} mAh</ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Battery temperature</ThemedText>
          <ThemedText style={styles.valueText}>{gaugeInfo.temperature_cdec / 10} °C</ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Connected daughter boards</ThemedText>
          <ThemedText style={styles.valueText}>IMU, Temperature</ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Firmware version</ThemedText>
          <ThemedText style={styles.valueText}>3.1.2</ThemedText>
        </View>
        <View style={styles.listRow}>
          <ThemedText type="defaultSemiBold">Mobile app version</ThemedText>
          <ThemedText style={styles.valueText}>1.3.4</ThemedText>
        </View>
        <View style={[styles.listRow, styles.listRowLast]}>
          <ThemedText type="defaultSemiBold">Website</ThemedText>
          <ExternalLink href="http://sens-wear.com/">
            <ThemedText type="link">sens-wear.com</ThemedText>
          </ExternalLink>
        </View>
      </ThemedView>
      <ThemedView style={styles.actions}>
        <Pressable style={[styles.actionButton, styles.logoutButton]} onPress={handleUnpairPress}>
          <ThemedText type="defaultSemiBold">Unpair device</ThemedText>
        </Pressable>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    bottom: -20,
    left: '55%',
    position: 'absolute',
    width: 150,
    height: 250,
    transform: [{ translateX: -100 }],
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  list: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  listRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#ebebeb',
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  valueText: {
    marginTop: 4,
    color: '#444',
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#efefef',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#ff7b73',
  },
});
