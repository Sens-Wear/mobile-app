import React, { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { TouchGesture } from 'senswear';
import {
  TOUCH_POSITION_MAX,
  touchPositionFromSample,
  touchPositionPercent,
} from '@/ble/touchAxis';
import { useBle } from '@/hooks/BleSessionProvider';

const CHART_WIDTH = Dimensions.get('window').width - 80;
const HISTORY_LENGTH = 120;

type ChannelPoint = {
  value: number;
  label?: string;
};

export default function TouchScreen() {
  const router = useRouter();
  const { client, isConnected } = useBle();
  const [gesture, setGesture] = useState('None');
  const [touched, setTouched] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [positionHistory, setPositionHistory] = useState<ChannelPoint[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!client || !isConnected) return () => {};
      let active = true;
      void (async () => {
        await client.touch.setSamplingEnabled(true);
        const initial = await client.touch.readState();
        if (active) {
          setTouched(initial.touched);
          const initialPosition = touchPositionFromSample(initial);
          setPosition(initialPosition);
          if (initialPosition !== null) setPositionHistory([{ value: initialPosition }]);
        }
        await client.touch.subscribeState((state) => {
          if (!active) return;
          setTouched(state.touched);
          const nextPosition = touchPositionFromSample(state);
          setPosition(nextPosition);
          if (nextPosition !== null) {
            setPositionHistory((previous) => [
              ...previous.slice(-(HISTORY_LENGTH - 1)),
              { value: nextPosition },
            ]);
          }
        });
        await client.touch.subscribeGesture((event) => {
          if (active) setGesture(touchGestureLabel(event.gesture));
        });
      })().catch(console.error);

      return () => {
        active = false;
        void client.touch.unsubscribeState();
        void client.touch.unsubscribeGesture();
      };
    }, [client, isConnected])
  );

  const positionRatio = position === null ? 0 : touchPositionPercent(position);
  const markerPercent = Math.max(2, Math.min(98, positionRatio * 100));
  const positionLabel = position === null ? '—' : Math.round(position).toString();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
            <Ionicons name="hand-left-outline" size={20} color="#153B2E" />
          </View>
        </View>

        <Text style={styles.eyebrow}>Touch demo</Text>
        <Text style={styles.heroTitle}>Inspect live touch position and gestures.</Text>
        <Text style={styles.heroSubtitle}>
          Follow movement along the daughter board&apos;s single touch axis and inspect normalized
          gestures decoded by the SensWear SDK.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="analytics-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>12-bit position</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>{touched ? 'Touch active' : 'Not touched'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Detected gesture</Text>
          <Text style={styles.summaryValue}>{gesture}</Text>
          <Text style={styles.summaryHint}>Latest normalized firmware gesture.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Position</Text>
          <Text style={styles.summaryValue}>{positionLabel}</Text>
          <Text style={styles.summaryHint}>Single-axis controller position from 0 to 4095.</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Touch position</Text>
            <Text style={styles.sectionCaption}>
              Current location along the daughter board&apos;s touch strip.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>0–4095</Text>
          </View>
        </View>

        <View style={styles.positionReadout}>
          <Text style={styles.positionValue}>{positionLabel}</Text>
          <Text style={styles.positionPercent}>
            {position === null ? 'Touch the strip' : `${Math.round(positionRatio * 100)}%`}
          </Text>
        </View>

        <View style={styles.touchTrack}>
          <View style={[styles.touchTrackFill, { width: `${positionRatio * 100}%` }]} />
          {position !== null && (
            <View style={[styles.touchMarker, { left: `${markerPercent}%` }]} />
          )}
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.trackLabel}>0</Text>
          <Text style={styles.trackLabel}>{TOUCH_POSITION_MAX}</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Position history</Text>
            <Text style={styles.sectionCaption}>
              Recent samples from the single touch axis.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>LIVE</Text>
          </View>
        </View>

        <LineChart
          width={CHART_WIDTH}
          height={250}
          areaChart
          startFillColor="#87bba2"
          endFillColor="#dbeee3"
          startOpacity={0.45}
          endOpacity={0.1}
          color1="#1b5e20"
          thickness={3}
          curved
          hideDataPoints={false}
          dataPointsColor="#1b5e20"
          dataPointsRadius={4}
          initialSpacing={16}
          endSpacing={16}
          spacing={3}
          yAxisTextStyle={styles.yAxisLabel}
          data={positionHistory}
          maxValue={TOUCH_POSITION_MAX}
          noOfSections={4}
        />
      </View>
    </ScrollView>
  );
}

function touchGestureLabel(gesture: TouchGesture): string {
  return TouchGesture[gesture]?.replace(/([a-z])([A-Z])/g, '$1 $2') ?? `Unknown (${gesture})`;
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
  sectionCard: {
    marginTop: 18,
    backgroundColor: '#FFF9F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E9DACC',
    padding: 18,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#14251F',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionCaption: {
    color: '#5F6B65',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    maxWidth: 240,
  },
  sectionBadge: {
    backgroundColor: '#E6F0EA',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionBadgeText: {
    color: '#153B2E',
    fontSize: 12,
    fontWeight: '800',
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#4b4b4b',
  },
  positionReadout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  positionValue: {
    color: '#14251F',
    fontSize: 40,
    fontWeight: '800',
  },
  positionPercent: {
    color: '#68736D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  touchTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: '#E1D7CC',
    marginTop: 18,
    position: 'relative',
  },
  touchTrackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#356B59',
  },
  touchMarker: {
    position: 'absolute',
    top: -5,
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    backgroundColor: '#153B2E',
    borderWidth: 4,
    borderColor: '#F1E3D2',
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  trackLabel: {
    color: '#68736D',
    fontSize: 12,
  },
});
