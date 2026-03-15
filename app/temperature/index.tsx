import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { decode as b64decode } from 'base-64';
import Legend from '@/components/ui/Legend';
import { TEMPERATURE_UUIDS } from '@/ble/bleConstants';
import { useBle } from '@/hooks/BleSessionProvider';

const MAX_LENGTH = 100;
const BUFFER_LIMIT = 100;
const CHART_WIDTH = Dimensions.get('window').width - 80;

type ChartPoint = { value: number };

export default function TemperatureScreen() {
  const { isConnected, monitor, readCharacteristic } = useBle();
  const [temperatureData, setTemperatureData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const chartRef = useRef<any>(null);
  const lastScrollRef = useRef(0);
  const temperatureBufferRef = useRef<number[]>([]);

  const currentTemperature =
    temperatureData.length > 0 ? temperatureData[temperatureData.length - 1].value : null;

  const chartRange = useMemo(() => {
    if (temperatureData.length === 0) return undefined;

    let min = temperatureData[0].value;
    let max = temperatureData[0].value;
    for (const point of temperatureData) {
      if (point.value < min) min = point.value;
      if (point.value > max) max = point.value;
    }

    const range = max - min;
    const padding = range > 0 ? range * 0.15 : Math.max(Math.abs(max) * 0.05, 0.5);
    return {
      min: min - padding,
      max: max + padding,
    };
  }, [temperatureData]);

  function base64ToBytes(base64: string) {
    const binary = b64decode(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readInt32LE(bytes: Uint8Array, offset: number) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getInt32(offset, true);
  }

  function parseTemperatureValue(rawValue: string | null) {
    if (!rawValue) return null;
    const bytes = base64ToBytes(rawValue);
    if (bytes.length < 4) return null;

    const temperature = readInt32LE(bytes, 0) / 1000;
    console.log(temperature);
    return temperature;
  }

  useFocusEffect(
    React.useCallback(() => {
      if (!isConnected) {
        setLoading(false);
        setTemperatureData([]);
        return () => {};
      }

      let isActive = true;
      setLoading(true);

      const pushTemperature = (value: number | null) => {
        if (value === null) return;
        temperatureBufferRef.current.push(value);
        if (temperatureBufferRef.current.length > BUFFER_LIMIT) {
          temperatureBufferRef.current.splice(0, temperatureBufferRef.current.length - BUFFER_LIMIT);
        }
      };

      const handleTemperatureUpdate = (c: { value: string | null }) => {
        pushTemperature(parseTemperatureValue(c.value));
      };

      const readTemperatureInitial = async () => {
        try {
          const c = await readCharacteristic(
            TEMPERATURE_UUIDS.SERVICE_UUID,
            TEMPERATURE_UUIDS.TEMPERATURE_CHANNEL_CHAR
          );
          if (isActive && c) {
            handleTemperatureUpdate(c);
          }
        } catch (e) {
          console.log(e);
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      readTemperatureInitial();

      const temperatureSub = monitor(
        TEMPERATURE_UUIDS.SERVICE_UUID,
        TEMPERATURE_UUIDS.TEMPERATURE_CHANNEL_CHAR,
        handleTemperatureUpdate,
        (e) => {
          console.log(e);
        }
      );

      const interval = setInterval(() => {
        const batch = temperatureBufferRef.current.splice(0);
        if (batch.length === 0) return;

        setTemperatureData((prevData) => {
          const next = [...prevData];
          for (const sample of batch) {
            next.push({ value: sample });
          }
          return next.slice(-MAX_LENGTH);
        });

        setLoading(false);
      }, 1000);

      return () => {
        isActive = false;
        temperatureSub.remove();
        clearInterval(interval);
        temperatureBufferRef.current = [];
      };
    }, [isConnected, monitor, readCharacteristic])
  );

  useEffect(() => {
    if (chartRef.current) {
      const now = Date.now();
      if (now - lastScrollRef.current > 400) {
        chartRef.current.scrollToEnd({ animated: false });
        lastScrollRef.current = now;
      }
    }
  }, [temperatureData]);

  const latestLabel = currentTemperature === null ? '--' : `${currentTemperature.toFixed(1)} °C`;
  const trendSpread =
    chartRange && currentTemperature !== null ? `${(chartRange.max - chartRange.min).toFixed(1)} °C range` : 'Awaiting samples';

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
            <Ionicons name="thermometer-outline" size={20} color="#153B2E" />
          </View>
        </View>

        <Text style={styles.eyebrow}>Temperature live view</Text>
        <Text style={styles.heroTitle}>Track live thermal readings from the connected device.</Text>
        <Text style={styles.heroSubtitle}>
          Monitor the latest sample and the rolling chart history using the same dashboard layout as
          the other sensor pages.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="pulse-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>Single channel</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>{loading ? 'Waiting for data' : 'Streaming'}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current reading</Text>
          <Text style={styles.summaryValue}>{latestLabel}</Text>
          <Text style={styles.summaryHint}>Latest decoded temperature notification.</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Observed spread</Text>
          <Text style={styles.summaryValue}>{trendSpread}</Text>
          <Text style={styles.summaryHint}>Calculated from the values visible in the chart.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#153B2E" />
          <Text style={styles.loadingTitle}>Waiting for temperature packets</Text>
          <Text style={styles.loadingText}>The chart will populate as soon as thermal samples arrive.</Text>
        </View>
      ) : (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Temperature chart</Text>
              <Text style={styles.sectionCaption}>
                Live rolling temperature history with an automatically padded chart range.
              </Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>THERMAL</Text>
            </View>
          </View>

          <Legend items={[{ label: 'Temperature', color: '#e67e22' }]} />

          <View style={styles.chartWrap}>
            <LineChart
              scrollRef={chartRef}
              width={CHART_WIDTH}
              height={220}
              showScrollIndicator
              hideDataPoints
              isAnimated={false}
              initialSpacing={0}
              endSpacing={0}
              spacing={10}
              data={temperatureData}
              color1="#e67e22"
              yAxisOffset={chartRange?.min}
              maxValue={chartRange ? chartRange.max - chartRange.min : undefined}
            />
          </View>
        </View>
      )}
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
    backgroundColor: '#F1E3D2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionBadgeText: {
    color: '#153B2E',
    fontSize: 12,
    fontWeight: '800',
  },
  chartWrap: {
    marginTop: 6,
    marginHorizontal: -6,
  },
});
