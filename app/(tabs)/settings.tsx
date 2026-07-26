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
import { useBle } from '@/hooks/BleSessionProvider';
import { useFocusedDaughterBoardState } from '@/hooks/useFocusedDaughterBoardState';
import {
  BATTERY_LEVEL_STATUS_UUID,
  BATTERY_LEVEL_UUID,
  ChargeState,
  type BatteryLevelStatus,
} from 'senswear';

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
  const [batteryPercent, setBatteryPercent] = useState<number | null>(null);
  const [powerStatus, setPowerStatus] = useState<BatteryLevelStatus | null>(null);
  const { forget, client, isConnected } = useBle();
  const daughterBoardState = useFocusedDaughterBoardState();

  useFocusEffect(
    React.useCallback(() => {
      if (!isConnected || !client) {
        return () => {};
      }
      let active = true;
      void (async () => {
        const [battery, power] = await Promise.all([client.battery.read(), client.power.read()]);
        if (active) {
          setBatteryPercent(battery.percent);
          setPowerStatus(power);
        }
        await client.battery.subscribe((value) => {
          if (active) setBatteryPercent(value.percent);
        });
        await client.power.subscribe((value) => {
          if (active) setPowerStatus(value);
        });
      })().catch(console.error);

      return () => {
        active = false;
        void client.stopNotify(BATTERY_LEVEL_UUID);
        void client.stopNotify(BATTERY_LEVEL_STATUS_UUID);
      };
    }, [isConnected, client])
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

  const isCharging = powerStatus?.chargeState === ChargeState.Charging;
  const chargeStatus = isCharging ? 'Charging' : powerStatus?.batteryPresent ? 'On battery' : 'Unknown';
  const batteryProgress = batteryPercent === null ? 0 : batteryPercent / 100;
  const batteryPercentage = batteryPercent === null ? '--' : `${batteryPercent}%`;
  const chargeColor = isCharging ? '#305CDE' : batteryPercent !== null && batteryPercent > 20 ? '#1C7C54' : '#AF2B1E';
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
