import React, { useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Progress from 'react-native-progress';
import { decode as b64decode } from 'base-64';
import { useBle } from '@/hooks/BleSessionProvider';
import { POWER_UUIDS } from '@/ble/bleConstants';
import { useFocusedDaughterBoardState } from '@/hooks/useFocusedDaughterBoardState';

const WEBSITE_URL = 'https://sens-wear.com';

type InfoRowProps = {
  label: string;
  value: string;
  isLast?: boolean;
};

function InfoRow({ label, value, isLast = false }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
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
  const daughterBoardState = useFocusedDaughterBoardState();

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

  const handleOpenWebsite = async () => {
    await Linking.openURL(WEBSITE_URL);
  };

  const chargeStatus = chargerInfo.bCharged
    ? 'Charged'
    : chargerInfo.bCharging
      ? 'Charging'
      : 'Not connected';
  const batteryProgress =
    gaugeInfo.state_of_charge_cdec > -1
      ? Math.min(1, Math.max(0, gaugeInfo.state_of_charge_cdec / 1000))
      : 0;
  const batteryPercentage =
    gaugeInfo.state_of_charge_cdec > -1 ? `${Math.floor(gaugeInfo.state_of_charge_cdec / 10)}%` : '--';
  const batteryTemperature =
    gaugeInfo.temperature_cdec > -1 ? `${(gaugeInfo.temperature_cdec / 10).toFixed(1)} C` : '--';
  const batteryCapacity =
    gaugeInfo.full_battery_capacity_mah > -1 ? `${gaugeInfo.full_battery_capacity_mah} mAh` : '--';
  const batteryVoltage = gaugeInfo.voltage_mv > -1 ? `${gaugeInfo.voltage_mv} mV` : '--';
  const batteryCurrent =
    gaugeInfo.average_current_ma > -1 ? `${gaugeInfo.average_current_ma} mA` : '--';
  const batteryPower = gaugeInfo.average_power_mw > -1 ? `${gaugeInfo.average_power_mw} mW` : '--';
  const chargeColor = chargerInfo.bCharging ? '#305CDE' : chargerInfo.bCharged ? '#1C7C54' : '#AF2B1E';
  const connectedBoardsValue =
    daughterBoardState.connectedBoardNames.length > 0
      ? daughterBoardState.connectedBoardNames.join(', ')
      : 'None detected';
  const activeBoardValue = connectedBoardsValue;
  const connectedBoardsLabel =
    daughterBoardState.connectedBoardNames.length === 1
      ? 'Connected daughter board'
      : 'Connected daughter boards';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#153B2E', '#356B59', '#D7C1A6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.eyebrow}>Device settings</Text>
            <Text style={styles.heroTitle}>Power health, board details and system actions.</Text>
          </View>
          <Image
            source={require('@/assets/images/setting-header.png')}
            style={styles.heroImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.heroFooter}>
          <View style={styles.batteryCircleWrap}>
            <Progress.Circle
              size={72}
              indeterminate={false}
              progress={batteryProgress}
              showsText={true}
              formatText={() => batteryPercentage}
              color={chargeColor}
              borderWidth={0}
              thickness={6}
              unfilledColor="rgba(255, 255, 255, 0.18)"
              textStyle={styles.batteryCircleText}
            />
          </View>

          <View style={styles.heroStatusCard}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: chargeColor }]} />
              <Text style={styles.statusLabel}>{chargeStatus}</Text>
            </View>
            <Text style={styles.statusSubtext}>Live power telemetry from the connected platform.</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.metricRow}>
        <View style={styles.metricCard}>
          <Ionicons name="thermometer-outline" size={18} color="#153B2E" />
          <Text style={styles.metricLabel}>Temperature</Text>
          <Text style={styles.metricValue}>{batteryTemperature}</Text>
        </View>
        <View style={styles.metricCard}>
          <Ionicons name="flash-outline" size={18} color="#153B2E" />
          <Text style={styles.metricLabel}>Voltage</Text>
          <Text style={styles.metricValue}>{batteryVoltage}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Battery overview</Text>
        <InfoRow label="Battery percentage" value={batteryPercentage} />
        <InfoRow label="Battery capacity" value={batteryCapacity} />
        <InfoRow label="Average current" value={batteryCurrent} />
        <InfoRow label="Average power" value={batteryPower} isLast />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Platform details</Text>
        <InfoRow label={connectedBoardsLabel} value={connectedBoardsValue} />
        <InfoRow label="Active daughter board" value={activeBoardValue} />
        <InfoRow label="Firmware version" value="3.1.2" />
        <InfoRow label="Mobile app version" value="1.3.4" isLast />
      </View>

      <LinearGradient
        colors={['#FFF9F2', '#F1E3D2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.websiteCard}>
        <View style={styles.websiteHeader}>
          <View style={styles.websiteIconWrap}>
            <Ionicons name="globe-outline" size={20} color="#153B2E" />
          </View>
          <View style={styles.websiteTextWrap}>
            <Text style={styles.websiteTitle}>SensWear website</Text>
            <Text style={styles.websiteText}>
              Browse platform details, hardware accessories and purchasing information.
            </Text>
          </View>
        </View>

        <Pressable style={styles.websiteButton} onPress={handleOpenWebsite}>
          <Text style={styles.websiteButtonText}>Open sens-wear.com</Text>
          <Ionicons name="open-outline" size={16} color="#F7F0E8" />
        </Pressable>
      </LinearGradient>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Device management</Text>
        <Text style={styles.dangerText}>
          Remove this device from the app and return to the onboarding flow.
        </Text>

        <Pressable style={styles.unpairButton} onPress={handleUnpairPress}>
          <Ionicons name="close-circle-outline" size={18} color="#FFF4F1" />
          <Text style={styles.unpairButtonText}>Unpair device</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EFE8',
  },
  content: {
    paddingTop: 50,
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
    alignItems: 'flex-start',
  },
  heroTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: '#F6ECE0',
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FDF9F4',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    marginTop: 8,
  },
  heroImage: {
    width: 88,
    height: 116,
    opacity: 0.95,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 14,
  },
  batteryCircleWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batteryCircleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F7F0E8',
  },
  heroStatusCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 20,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusLabel: {
    color: '#FDF9F4',
    fontSize: 16,
    fontWeight: '800',
  },
  statusSubtext: {
    color: '#E5D8CC',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFF9F2',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 16,
  },
  metricLabel: {
    color: '#68736D',
    fontSize: 12,
    marginTop: 10,
  },
  metricValue: {
    color: '#14251F',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  sectionCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  sectionTitle: {
    color: '#14251F',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 6,
  },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EBDDCE',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    color: '#425049',
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    color: '#14251F',
    fontSize: 15,
    marginTop: 5,
  },
  websiteCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
  },
  websiteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  websiteIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(21, 59, 46, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  websiteTextWrap: {
    flex: 1,
  },
  websiteTitle: {
    color: '#14251F',
    fontSize: 20,
    fontWeight: '800',
  },
  websiteText: {
    color: '#4F5C56',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  websiteButton: {
    marginTop: 16,
    backgroundColor: '#153B2E',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  websiteButtonText: {
    color: '#F7F0E8',
    fontSize: 14,
    fontWeight: '800',
  },
  dangerCard: {
    marginTop: 18,
    backgroundColor: '#2B1716',
    borderRadius: 24,
    padding: 18,
  },
  dangerTitle: {
    color: '#FFF4F1',
    fontSize: 20,
    fontWeight: '800',
  },
  dangerText: {
    color: '#E8CCCA',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  unpairButton: {
    marginTop: 16,
    backgroundColor: '#B4473B',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unpairButtonText: {
    color: '#FFF4F1',
    fontSize: 14,
    fontWeight: '800',
  },
});
