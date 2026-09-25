import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { useCsvExport } from '@/hooks/useCsvExport'
import { CsvShareButton, CsvExportHint } from '@/components/CsvShareButton'
import { afterStreamCleanup, finishStreamSession } from '@/utils/streamLifecycle'
import Legend from '@/components/ui/Legend';
import { useBle } from '@/hooks/BleSessionProvider';
import { PPG_GREEN_UUID, PPG_INFRARED_UUID, PPG_RED_UUID } from 'senswear';

const MAX_LENGTH = 500;
const CSV_COLUMNS = ['received_at_utc', 'device_timestamp_ms', 'channel', 'value_raw_adc']
const BUFFER_LIMIT = 500;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 80;

export default function DevicesScreen() {
  const { client, isConnected } = useBle();
  const { record, share, sharing } = useCsvExport('PPG', CSV_COLUMNS)
  const [rawRedData, setRawRedData] = useState<{ value: number }[]>([]);
  const [rawIRData, setRawIRData] = useState<{ value: number }[]>([]);
  const [rawGreenData, setRawGreenData] = useState<{ value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const lastRedScrollRef = useRef(0);
  const lastIRScrollRef = useRef(0);
  const lastGreenScrollRef = useRef(0);
  const router = useRouter();
  const rawRedDataChartRef = useRef<any>(null);
  const rawIRDataChartRef = useRef<any>(null);
  const rawGreenDataChartRef = useRef<any>(null);
  const rawGreenBufferRef = useRef<{ green: number }[]>([]);
  const rawRedBufferRef = useRef<{ red: number }[]>([]);
  const rawIRBufferRef = useRef<{ ir: number }[]>([]);

  const getPaddedRange = (data: { value: number }[]) => {
    if (!data || data.length === 0) return undefined;
    let min = data[0].value;
    let max = data[0].value;
    for (const point of data) {
      if (point.value < min) min = point.value;
      if (point.value > max) max = point.value;
    }
    const range = max - min;
    const padding = range > 0 ? range * 0.1 : Math.max(Math.abs(max) * 0.05, 1);
    const paddedMin = min - padding;
    const paddedMax = max + padding;
    return {
      min: min <= 0 ? Math.min(0, paddedMin) : paddedMin,
      max: paddedMax,
    };
  };

  const redRange = useMemo(() => getPaddedRange(rawRedData), [rawRedData]);
  const irRange = useMemo(() => getPaddedRange(rawIRData), [rawIRData]);
  const greenRange = useMemo(() => getPaddedRange(rawGreenData), [rawGreenData]);

  useFocusEffect(
    React.useCallback(() => {
      if (!client || !isConnected) {
        setLoading(false);
        return () => {};
      }
      let active = true;
      setLoading(true);
      const setup = afterStreamCleanup(client.ppg, async () => {
        if (!active) return
        await client.ppg.setSamplingEnabled(true);
        if (!active) return;
        await client.ppg.subscribeRed((sample) => {
          if (!active) return;
          rawRedBufferRef.current.push({ red: sample.value });
          record({ device_timestamp_ms: sample.timestampMs, channel: 'red', value_raw_adc: sample.value })
          if (rawRedBufferRef.current.length > BUFFER_LIMIT) {
            rawRedBufferRef.current.splice(0, rawRedBufferRef.current.length - BUFFER_LIMIT);
          }
        });
        if (!active) return;
        await client.ppg.subscribeInfrared((sample) => {
          if (!active) return;
          rawIRBufferRef.current.push({ ir: sample.value });
          record({ device_timestamp_ms: sample.timestampMs, channel: 'ir', value_raw_adc: sample.value })
          if (rawIRBufferRef.current.length > BUFFER_LIMIT) {
            rawIRBufferRef.current.splice(0, rawIRBufferRef.current.length - BUFFER_LIMIT);
          }
        });
        if (!active) return;
        await client.ppg.subscribeGreen((sample) => {
          if (!active) return;
          rawGreenBufferRef.current.push({ green: sample.value });
          record({ device_timestamp_ms: sample.timestampMs, channel: 'green', value_raw_adc: sample.value })
          if (rawGreenBufferRef.current.length > BUFFER_LIMIT) {
            rawGreenBufferRef.current.splice(0, rawGreenBufferRef.current.length - BUFFER_LIMIT);
          }
        });
      }).catch((error) => {
        console.error(error)
        if (active) setLoading(false)
      });

      const interval = setInterval(() => {
        const redBatch = rawRedBufferRef.current.splice(0);
        const irBatch = rawIRBufferRef.current.splice(0);
        const greenBatch = rawGreenBufferRef.current.splice(0);
        if (redBatch.length === 0 && irBatch.length === 0 && greenBatch.length === 0) return;

        if (redBatch.length > 0) {
          setRawRedData((prevData) => {
            const red = [...prevData];
            for (const sample of redBatch) {
              red.push({ value: sample.red });
            }
            return red.slice(-MAX_LENGTH);
          });
        }

        if (irBatch.length > 0) {
          setRawIRData((prevData) => {
            const ir = [...prevData];
            for (const sample of irBatch) {
              ir.push({ value: sample.ir });
            }
            return ir.slice(-MAX_LENGTH);
          });
        }

        if (greenBatch.length > 0) {
          setRawGreenData((prevData) => {
            const green = [...prevData];
            for (const sample of greenBatch) {
              green.push({ value: sample.green });
            }
            return green.slice(-MAX_LENGTH);
          });
        }

        setLoading((prev) => (prev ? false : prev));
      }, 500);

      return () => {
        active = false;
        finishStreamSession(client.ppg, () => setup.then(async () => {
          await Promise.allSettled([
            client.ppg.unsubscribe(PPG_RED_UUID),
            client.ppg.unsubscribe(PPG_INFRARED_UUID),
            client.ppg.unsubscribe(PPG_GREEN_UUID),
          ])
        }));
        clearInterval(interval);
        rawRedBufferRef.current = [];
        rawIRBufferRef.current = [];
        rawGreenBufferRef.current = [];
      };
    }, [client, isConnected, record])
  );

  useEffect(() => {
    if (rawRedDataChartRef.current) {
      const now = Date.now();
      if (now - lastRedScrollRef.current > 400) {
        rawRedDataChartRef.current.scrollToEnd({ animated: false });
        lastRedScrollRef.current = now;
      }
    }
  }, [rawRedData]);

  useEffect(() => {
    if (rawIRDataChartRef.current) {
      const now = Date.now();
      if (now - lastIRScrollRef.current > 400) {
        rawIRDataChartRef.current.scrollToEnd({ animated: false });
        lastIRScrollRef.current = now;
      }
    }
  }, [rawIRData]);

  useEffect(() => {
    if (rawGreenDataChartRef.current) {
      const now = Date.now();
      if (now - lastGreenScrollRef.current > 400) {
        rawGreenDataChartRef.current.scrollToEnd({ animated: false });
        lastGreenScrollRef.current = now;
      }
    }
  }, [rawGreenData]);

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

          <CsvShareButton onPress={share} sharing={sharing} />
        </View>

        <Text style={styles.eyebrow}>PPG live view</Text>
        <Text style={styles.heroTitle}>Optical signal channels, captured continuously.</Text>
        <Text style={styles.heroSubtitle}>
          Review red, infrared and green sensor streams while keeping CSV export one tap away.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="pulse-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>3 channels</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="download-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>CSV export</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="radio-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>{loading ? 'Waiting for data' : 'Streaming'}</Text>
          </View>
        </View>
      </LinearGradient>
      <CsvExportHint />

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Channels</Text>
          <Text style={styles.summaryValue}>Red / IR / Green</Text>
          <Text style={styles.summaryHint}>Live optical waveform capture</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Export</Text>
          <Text style={styles.summaryValue}>CSV logging</Text>
          <Text style={styles.summaryHint}>Timestamped samples preserved</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#153B2E" />
          <Text style={styles.loadingTitle}>Waiting for PPG packets</Text>
          <Text style={styles.loadingText}>Charts will populate when optical samples arrive.</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Red Channel</Text>
                <Text style={styles.sectionCaption}>Primary optical readings from the red LED path.</Text>
              </View>
              <View style={[styles.sectionBadge, styles.redBadge]}>
                <Text style={styles.sectionBadgeText}>RED</Text>
              </View>
            </View>

            <Legend items={[{ label: 'Red', color: 'red' }]} />

            <View style={styles.chartWrap}>
              <LineChart
                scrollRef={rawRedDataChartRef}
                width={CHART_WIDTH}
                showScrollIndicator={true}
                hideDataPoints
                isAnimated={false}
                interpolateMissingValues={false}
                initialSpacing={0}
                endSpacing={0}
                spacing={1}
                data={rawRedData}
                color1="red"
                yAxisOffset={redRange?.min}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>IR Channel</Text>
                <Text style={styles.sectionCaption}>Infrared stream used for deep optical comparisons.</Text>
              </View>
              <View style={[styles.sectionBadge, styles.irBadge]}>
                <Text style={styles.sectionBadgeText}>IR</Text>
              </View>
            </View>

            <Legend items={[{ label: 'IR', color: 'black' }]} />

            <View style={styles.chartWrap}>
              <LineChart
                scrollRef={rawIRDataChartRef}
                width={CHART_WIDTH}
                showScrollIndicator={true}
                hideDataPoints
                isAnimated={false}
                interpolateMissingValues={false}
                initialSpacing={0}
                endSpacing={0}
                spacing={1}
                data={rawIRData}
                color1="black"
                yAxisOffset={irRange?.min}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Green Channel</Text>
                <Text style={styles.sectionCaption}>Green optical samples for signal balancing and checks.</Text>
              </View>
              <View style={[styles.sectionBadge, styles.greenBadge]}>
                <Text style={styles.sectionBadgeText}>GREEN</Text>
              </View>
            </View>

            <Legend items={[{ label: 'Green', color: 'lime' }]} />

            <View style={styles.chartWrap}>
              <LineChart
                scrollRef={rawGreenDataChartRef}
                width={CHART_WIDTH}
                showScrollIndicator={true}
                hideDataPoints
                isAnimated={false}
                interpolateMissingValues={false}
                initialSpacing={0}
                endSpacing={0}
                spacing={1}
                data={rawGreenData}
                color1="lime"
                yAxisOffset={greenRange?.min}
              />
            </View>
          </View>
        </>
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
  iconButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
    marginBottom: 2,
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  redBadge: {
    backgroundColor: '#F5D4CF',
  },
  irBadge: {
    backgroundColor: '#DDD8D1',
  },
  greenBadge: {
    backgroundColor: '#D8E8D4',
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
