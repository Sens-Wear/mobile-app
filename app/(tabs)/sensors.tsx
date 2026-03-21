import React, { useState } from 'react';
import {
  FlatList,
  Image,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';
import { decode as b64decode } from 'base-64';
import { useBle } from '@/hooks/BleSessionProvider';
import {
  isSensorModuleActive,
  isSensorModuleAvailable,
} from '@/ble/daughterBoardState';
import { POWER_UUIDS } from '@/ble/bleConstants';
import { useFocusedDaughterBoardState } from '@/hooks/useFocusedDaughterBoardState';
import type { SensorModuleKey } from '@/constants/DaughterBoardConstants';

type SensorDefinition = {
  id: string;
  name: string;
  moduleKey: SensorModuleKey;
  description: string;
  icon: number;
  link: string;
};

const sensors: SensorDefinition[] = [
  {
    id: '1',
    name: 'LED',
    moduleKey: 'LED',
    description: 'Light patterns and visual feedback',
    icon: require('@/assets/images/dashboard_icons/led.png'),
    link: '/led',
  },
  {
    id: '2',
    name: 'IMU',
    moduleKey: 'IMU',
    description: 'Motion, posture and movement data',
    icon: require('@/assets/images/dashboard_icons/imu.png'),
    link: '/imu',
  },
  {
    id: '3',
    name: 'PPG',
    moduleKey: 'PPG',
    description: 'Heart-rate signal and pulse trends',
    icon: require('@/assets/images/dashboard_icons/heart_rate.png'),
    link: '/ppg',
  },
  {
    id: '4',
    name: 'Temperature',
    moduleKey: 'Temperature',
    description: 'Body and ambient temperature checks',
    icon: require('@/assets/images/dashboard_icons/temperature.png'),
    link: '/temperature',
  },
  {
    id: '5',
    name: 'Touch',
    moduleKey: 'Touch',
    description: 'Touch sensing and interaction events',
    icon: require('@/assets/images/dashboard_icons/touch.png'),
    link: '/touch',
  },
  {
    id: '6',
    name: 'Vibration',
    moduleKey: 'Vibration',
    description: 'Haptic feedback and motor control',
    icon: require('@/assets/images/dashboard_icons/vibration.png'),
    link: '/vibration',
  },
];

const WEBSITE_URL = 'https://sens-wear.com';

export default function SensorsScreen() {
  const [gaugeInfo, setGaugeInfo] = useState({
    state_of_charge_cdec: -1,
  });
  const [chargerInfo, setChargerInfo] = useState({
    bCharging: false,
  });
  const { monitor, readCharacteristic, isConnected } = useBle();
  const daughterBoardState = useFocusedDaughterBoardState();
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
      return '#305CDE';
    }
    if (gaugeInfo.state_of_charge_cdec < 300) {
      return '#AF2B1E';
    }
    return '#1C7C54';
  };

  const progressFunction = (progress: number) => {
    if (chargerInfo.bCharging) {
      return 'CHG';
    }
    return `${Math.max(0, Math.floor(progress * 100))}%`;
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
        if (bytes.length < 16) return;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let o = 0;

        const i16 = () => {
          const value = view.getInt16(o, true);
          o += 2;
          return value;
        };
        const u16 = () => {
          const value = view.getUint16(o, true);
          o += 2;
          return value;
        };

        i16();
        u16();
        i16();
        i16();
        const state_of_charge_cdec = u16();
        u16();
        u16();
        u16();

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

  const handleSelectSensor = (pathName: string) => {
    router.push({ pathname: pathName as never });
  };

  const handleOpenWebsite = async () => {
    await Linking.openURL(WEBSITE_URL);
  };

  const batteryProgress =
    gaugeInfo.state_of_charge_cdec > -1
      ? Math.min(1, Math.max(0, gaugeInfo.state_of_charge_cdec / 1000))
      : 0;
  const batteryLabel =
    gaugeInfo.state_of_charge_cdec > -1
      ? `${Math.floor(gaugeInfo.state_of_charge_cdec / 10)}% battery`
      : 'Battery status pending';
  const readyModulesLabel = `${daughterBoardState.readyModuleCount} ${
    daughterBoardState.readyModuleCount === 1 ? 'module' : 'modules'
  } ready`;

  return (
    <View style={styles.container}>
      <FlatList
        data={sensors}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.sensorList}
        columnWrapperStyle={styles.sensorRow}
        ListHeaderComponent={
          <>
            <LinearGradient
              colors={['#153B2E', '#356B59', '#D7C1A6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}>
              <View style={styles.header}>
                <View style={styles.headerBrand}>
                  <Image
                    source={require('@/assets/images/react-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                  <Text style={styles.headerEyebrow}>Connected dashboard</Text>
                </View>

                <View style={styles.batteryWrap}>
                  <Progress.Circle
                    size={42}
                    indeterminate={false}
                    progress={batteryProgress}
                    textStyle={styles.batteryCircleText}
                    showsText={true}
                    thickness={3}
                    borderWidth={0}
                    color={batteryStatusColors()}
                    unfilledColor="rgba(255, 255, 255, 0.18)"
                    formatText={progressFunction}
                  />
                </View>
              </View>

              <Text style={styles.heroTitle}>Explore every sensor on your SensWear platform.</Text>
              <Text style={styles.heroSubtitle}>
                Launch live views, validate hardware behaviour and move quickly between modules from
                one place.
              </Text>

              <View style={styles.heroMetaRow}>
                <View style={styles.metaPill}>
                  <Ionicons name="hardware-chip-outline" size={16} color="#153B2E" />
                  <Text style={styles.metaPillText}>{readyModulesLabel}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Ionicons name="battery-half-outline" size={16} color="#153B2E" />
                  <Text style={styles.metaPillText}>{batteryLabel}</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sensor shortcuts</Text>
              <Text style={styles.sectionCaption}>Jump straight into live controls and readings.</Text>
            </View>
          </>
        }
        ListFooterComponent={
          <LinearGradient
            colors={['#132B24', '#24483D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.footerCard}>
            <View style={styles.footerIconWrap}>
              <Ionicons name="globe-outline" size={22} color="#F7F0E8" />
            </View>
            <Text style={styles.footerTitle}>Need daughter boards or extra hardware?</Text>
            <Text style={styles.footerText}>
              Visit the SensWear website for platform details, accessory information and purchasing
              options.
            </Text>

            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.footerPrimaryButton} onPress={handleOpenWebsite}>
                <Text style={styles.footerPrimaryText}>Visit website</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerGhostButton} onPress={handleOpenWebsite}>
                <Ionicons name="open-outline" size={16} color="#F7F0E8" />
                <Text style={styles.footerGhostText}>Shop boards</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        }
        renderItem={({ item }) => {
          const isAvailable = isSensorModuleAvailable(item.moduleKey, daughterBoardState);
          const isActive = isSensorModuleActive(item.moduleKey, daughterBoardState);
          const statusLabel =
            item.moduleKey === 'IMU' || item.moduleKey === 'LED'
              ? 'Main board'
              : isAvailable
                ? 'Active board'
                : 'Not connected';

          return (
            <TouchableOpacity
              style={[
                styles.sensorItem,
                !isAvailable && styles.sensorItemDisabled,
                isActive && styles.sensorItemActive,
              ]}
              onPress={() => handleSelectSensor(item.link)}
              disabled={!isAvailable}>
              <View
                style={[
                  styles.sensorIconWrap,
                  !isAvailable && styles.sensorIconWrapDisabled,
                  isActive && styles.sensorIconWrapActive,
                ]}>
              <Image source={item.icon} style={styles.sensorIcon} resizeMode="contain" />
              </View>
              <Text
                style={[
                  styles.sensorName,
                  !isAvailable && styles.sensorNameDisabled,
                  isActive && styles.sensorNameActive,
                ]}>
                {item.name}
              </Text>
              <Text style={[styles.sensorDescription, !isAvailable && styles.sensorDescriptionDisabled]}>
                {item.description}
              </Text>
              <View
                style={[
                  styles.sensorStatusPill,
                  !isAvailable && styles.sensorStatusPillDisabled,
                  isActive && styles.sensorStatusPillActive,
                ]}>
                <Text
                  style={[
                    styles.sensorStatusText,
                    !isAvailable && styles.sensorStatusTextDisabled,
                    isActive && styles.sensorStatusTextActive,
                  ]}>
                  {statusLabel}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE8',
    paddingTop: 50,
  },
  sensorList: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerBrand: {
    gap: 8,
    alignItems: 'flex-start',
    flexShrink: 1,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#153B2E',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  logo: {
    width: 112,
    height: 34,
  },
  headerEyebrow: {
    color: '#F6ECE0',
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  batteryWrap: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 999,
    padding: 8,
  },
  batteryCircleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F7F0E8',
  },
  heroTitle: {
    color: '#FDF9F4',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    maxWidth: '90%',
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
  sectionHeader: {
    marginBottom: 6,
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
  sensorRow: {
    justifyContent: 'space-between',
  },
  sensorItem: {
    width: '48%',
    backgroundColor: '#FFF9F2',
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    shadowColor: '#6B5C4D',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sensorItemDisabled: {
    backgroundColor: '#ECE7E1',
    borderColor: '#DDD3C9',
  },
  sensorItemActive: {
    borderColor: '#356B59',
    shadowOpacity: 0.14,
  },
  sensorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E6F0EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorIconWrapDisabled: {
    backgroundColor: '#DDD7D0',
  },
  sensorIconWrapActive: {
    backgroundColor: '#D6E8DF',
  },
  sensorIcon: {
    width: 60,
    height: 60,
  },
  sensorName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14251F',
    marginTop: 12,
  },
  sensorNameDisabled: {
    color: '#768078',
  },
  sensorNameActive: {
    color: '#153B2E',
  },
  sensorDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#68736D',
    marginTop: 6,
  },
  sensorDescriptionDisabled: {
    color: '#8A918B',
  },
  sensorStatusPill: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#E6F0EA',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sensorStatusPillDisabled: {
    backgroundColor: '#D9D2CB',
  },
  sensorStatusPillActive: {
    backgroundColor: '#153B2E',
  },
  sensorStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#153B2E',
  },
  sensorStatusTextDisabled: {
    color: '#6E746F',
  },
  sensorStatusTextActive: {
    color: '#F7F0E8',
  },
  footerCard: {
    marginTop: 28,
    borderRadius: 28,
    padding: 22,
  },
  footerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  footerTitle: {
    color: '#FDF9F4',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  footerText: {
    color: '#D8E1DB',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  footerActions: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  footerPrimaryButton: {
    backgroundColor: '#F2E3D0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  footerPrimaryText: {
    color: '#14251F',
    fontSize: 14,
    fontWeight: '800',
  },
  footerGhostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(247, 240, 232, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  footerGhostText: {
    color: '#F7F0E8',
    fontSize: 14,
    fontWeight: '700',
  },
});
