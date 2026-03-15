import React, { useMemo, useRef, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';

const ELECTRODE_COUNT = 15;
const UPDATE_INTERVAL_MS = 250;
const GESTURE_DURATION_MS = 3000;
const CHART_WIDTH = Dimensions.get('window').width - 80;

type ChannelPoint = {
  value: number;
  label?: string;
};

type GestureName =
  | 'Idle'
  | 'Tap'
  | 'Double Tap'
  | 'Swipe Left'
  | 'Swipe Right'
  | 'Press and Hold';

const GESTURES: GestureName[] = ['Idle', 'Tap', 'Double Tap', 'Swipe Left', 'Swipe Right', 'Press and Hold'];

export default function TouchScreen() {
  const router = useRouter();
  const [gesture, setGesture] = useState<GestureName>('Idle');
  const [channelValues, setChannelValues] = useState<number[]>(
    Array.from({ length: ELECTRODE_COUNT }, () => 0)
  );
  const gestureStartedAtRef = useRef(Date.now());
  const gestureIndexRef = useRef(0);
  const gestureCenterRef = useRef(7);

  const chartData = useMemo<ChannelPoint[]>(
    () =>
      channelValues.map((value, index) => ({
        value,
        label: `E${index + 1}`,
      })),
    [channelValues]
  );

  const chartRange = useMemo(() => {
    let min = channelValues[0] ?? 0;
    let max = channelValues[0] ?? 0;

    for (const value of channelValues) {
      if (value < min) min = value;
      if (value > max) max = value;
    }

    const range = max - min;
    const padding = range > 0 ? range * 0.15 : 40;
    return {
      min: Math.max(0, min - padding),
      max: max + padding,
    };
  }, [channelValues]);

  const strongestElectrode = useMemo(() => {
    let strongestIndex = 0;
    let strongestValue = channelValues[0] ?? 0;
    channelValues.forEach((value, index) => {
      if (value > strongestValue) {
        strongestIndex = index;
        strongestValue = value;
      }
    });
    return { index: strongestIndex + 1, value: strongestValue };
  }, [channelValues]);

  useFocusEffect(
    React.useCallback(() => {
      const pickNextGesture = () => {
        gestureIndexRef.current = (gestureIndexRef.current + 1) % GESTURES.length;
        gestureStartedAtRef.current = Date.now();
        gestureCenterRef.current = 2 + Math.floor(Math.random() * (ELECTRODE_COUNT - 4));
        setGesture(GESTURES[gestureIndexRef.current]);
      };

      setGesture(GESTURES[gestureIndexRef.current]);
      setChannelValues(generateFrame(GESTURES[gestureIndexRef.current], 0, gestureCenterRef.current));

      const interval = setInterval(() => {
        const elapsed = Date.now() - gestureStartedAtRef.current;
        if (elapsed >= GESTURE_DURATION_MS) {
          pickNextGesture();
          return;
        }

        setChannelValues(
          generateFrame(GESTURES[gestureIndexRef.current], elapsed / GESTURE_DURATION_MS, gestureCenterRef.current)
        );
      }, UPDATE_INTERVAL_MS);

      return () => {
        clearInterval(interval);
      };
    }, [])
  );

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
        <Text style={styles.heroTitle}>Preview gesture patterns across the full electrode strip.</Text>
        <Text style={styles.heroSubtitle}>
          This simulated MTCH6102 view cycles through gesture states and updates a 15-channel profile
          without changing the pending BLE integration path.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="analytics-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>15 electrodes</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>Simulated stream</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Detected gesture</Text>
          <Text style={styles.summaryValue}>{gesture}</Text>
          <Text style={styles.summaryHint}>Cycles automatically every few seconds.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Peak electrode</Text>
          <Text style={styles.summaryValue}>E{strongestElectrode.index}</Text>
          <Text style={styles.summaryHint}>{Math.round(strongestElectrode.value)} units in the current frame.</Text>
        </View>
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Electrode profile</Text>
            <Text style={styles.sectionCaption}>
              Area chart of the current 15-electrode response curve.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>15 CH</Text>
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
          spacing={20}
          xAxisLabelTextStyle={styles.xAxisLabel}
          yAxisTextStyle={styles.yAxisLabel}
          data={chartData}
          yAxisOffset={chartRange.min}
          maxValue={chartRange.max - chartRange.min}
          noOfSections={4}
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Channel values</Text>
            <Text style={styles.sectionCaption}>
              Per-electrode values from the current simulated touch frame.
            </Text>
          </View>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>LIVE</Text>
          </View>
        </View>

        <View style={styles.channelGrid}>
          {channelValues.map((value, index) => (
            <View key={`channel-${index + 1}`} style={styles.channelCard}>
              <Text style={styles.channelName}>E{index + 1}</Text>
              <Text style={styles.channelValue}>{Math.round(value)}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function generateFrame(gesture: GestureName, progress: number, center: number) {
  const base = Array.from({ length: ELECTRODE_COUNT }, (_, index) => {
    const noise = 8 + Math.random() * 14;
    return noise + index * 0.8;
  });

  switch (gesture) {
    case 'Idle':
      return base;
    case 'Tap':
      return applyPeak(base, center, 220 * Math.sin(progress * Math.PI));
    case 'Double Tap': {
      const firstPulse = Math.sin(Math.min(progress * 2, 1) * Math.PI);
      const secondPulse = progress > 0.5 ? Math.sin((progress - 0.5) * 2 * Math.PI) : 0;
      return applyPeak(base, center, 180 * Math.max(firstPulse, secondPulse));
    }
    case 'Swipe Left':
      return applyPeak(base, Math.round((ELECTRODE_COUNT - 2) - progress * (ELECTRODE_COUNT - 4)), 190);
    case 'Swipe Right':
      return applyPeak(base, Math.round(1 + progress * (ELECTRODE_COUNT - 4)), 190);
    case 'Press and Hold':
      return applyPeak(base, center, 170 + Math.sin(progress * Math.PI * 4) * 18);
    default:
      return base;
  }
}

function applyPeak(values: number[], center: number, amplitude: number) {
  return values.map((value, index) => {
    const distance = Math.abs(index - center);
    const spread = Math.exp(-(distance * distance) / 3.2);
    return Math.max(0, value + amplitude * spread);
  });
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
  xAxisLabel: {
    fontSize: 10,
    color: '#4b4b4b',
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#4b4b4b',
  },
  channelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  channelCard: {
    width: '30%',
    minWidth: 92,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F1E3D2',
    alignItems: 'center',
  },
  channelName: {
    fontSize: 13,
    color: '#68736D',
    marginBottom: 6,
  },
  channelValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14251F',
  },
});
