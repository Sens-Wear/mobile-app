import React, { useEffect, useRef, useState } from 'react';
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
import Legend from '@/components/ui/Legend';
import { useBle } from '@/hooks/BleSessionProvider';
import { IMU_ACCELEROMETER_UUID, IMU_QUATERNION_UUID } from 'senswear';
import { useCsvExport } from '@/hooks/useCsvExport'
import { CsvShareButton, CsvExportHint } from '@/components/CsvShareButton'
import { afterStreamCleanup, finishStreamSession } from '@/utils/streamLifecycle'

const CSV_COLUMNS = ['received_at_utc', 'device_timestamp_us', 'stream', 'acceleration_x_g',
  'acceleration_y_g', 'acceleration_z_g', 'quaternion_x', 'quaternion_y', 'quaternion_z', 'quaternion_w']

const MAX_LENGTH = 500;
const BUFFER_LIMIT = 500;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 80;

export default function DevicesScreen() {
  const { client, isConnected } = useBle();
  const { record, share, sharing } = useCsvExport('IMU', CSV_COLUMNS)
  const [accData, setAccData] = useState<{
    x: { value: number }[]; y: { value: number }[]; z: { value: number }[];
  }>({
    x: [], y: [], z: [],
  });
  const [gyroData, setGyroData] = useState<{
    x: { value: number }[]; y: { value: number }[]; z: { value: number }[]; w: { value: number }[];
  }>({
    x: [], y: [], z: [], w: [],
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const accChartRef = useRef<any>(null);
  const gyroDataChartRef = useRef<any>(null);
  const lastScrollRef = useRef(0);
  const accBufferRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const gyroBufferRef = useRef<{ x: number; y: number; z: number; w: number }[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!client || !isConnected) {
        setLoading(false);
        return () => {};
      }
      let active = true;
      setLoading(true);
      const setup = afterStreamCleanup(client.imu, async () => {
        if (!active) return
        await client.imu.setEnabled(true);
        if (!active) return;
        await client.imu.setDrainPeriodMs(100);
        if (!active) return;
        await client.imu.subscribeAccelerometer((sample) => {
          if (!active) return;
          record({ device_timestamp_us: sample.timestampUs, stream: 'accelerometer',
            acceleration_x_g: sample.xG, acceleration_y_g: sample.yG, acceleration_z_g: sample.zG })
          const dataToPush = {
            x: sample.xG,
            y: sample.yG,
            z: sample.zG,
          };
          accBufferRef.current.push(dataToPush);
          if (accBufferRef.current.length > BUFFER_LIMIT) {
            accBufferRef.current.splice(0, accBufferRef.current.length - BUFFER_LIMIT);
          }
        });
        if (!active) return;
        await client.imu.subscribeQuaternion((sample) => {
          if (!active) return;
          record({ device_timestamp_us: sample.timestampUs, stream: 'quaternion',
            quaternion_x: sample.x, quaternion_y: sample.y, quaternion_z: sample.z, quaternion_w: sample.w })
          const dataToPush = {
            x: sample.x, y: sample.y, z: sample.z, w: sample.w,
          };
          gyroBufferRef.current.push(dataToPush);
          if (gyroBufferRef.current.length > BUFFER_LIMIT) {
            gyroBufferRef.current.splice(0, gyroBufferRef.current.length - BUFFER_LIMIT);
          }
        });
      }).catch((error) => {
        console.error(error)
        if (active) setLoading(false)
      });

      const interval = setInterval(() => {
        const accBatch = accBufferRef.current.splice(0);
        const gyroBatch = gyroBufferRef.current.splice(0);
        if (accBatch.length === 0 && gyroBatch.length === 0) return;

        if (accBatch.length > 0) {
          setAccData((prevData) => {
            const x = [...prevData.x];
            const y = [...prevData.y];
            const z = [...prevData.z];

            for (const sample of accBatch) {
              x.push({ value: sample.x });
              y.push({ value: sample.y });
              z.push({ value: sample.z });
            }
            return {
              x: x.slice(-MAX_LENGTH),
              y: y.slice(-MAX_LENGTH),
              z: z.slice(-MAX_LENGTH),
            };
          });
        }

        if (gyroBatch.length > 0) {
          setGyroData((prevData) => {
            const x = [...prevData.x];
            const y = [...prevData.y];
            const z = [...prevData.z];
            const w = [...prevData.w];
            for (const sample of gyroBatch) {
              x.push({ value: sample.x });
              y.push({ value: sample.y });
              z.push({ value: sample.z });
              w.push({ value: sample.w });
            }
            return {
              x: x.slice(-MAX_LENGTH),
              y: y.slice(-MAX_LENGTH),
              z: z.slice(-MAX_LENGTH),
              w: w.slice(-MAX_LENGTH),
            };
          });
        }

        setLoading((prev) => (prev ? false : prev));
      }, 500);

      return () => {
        active = false;
        finishStreamSession(client.imu, () => setup.then(async () => {
          await Promise.allSettled([
            client.imu.unsubscribe(IMU_ACCELEROMETER_UUID),
            client.imu.unsubscribe(IMU_QUATERNION_UUID),
          ])
        }));
        clearInterval(interval);
        accBufferRef.current = [];
        gyroBufferRef.current = [];
      };
    }, [client, isConnected, record])
  );

  useEffect(() => {
    if (accChartRef.current) {
      const now = Date.now();
      if (now - lastScrollRef.current > 400) {
        accChartRef.current.scrollToEnd({ animated: false });
        lastScrollRef.current = now;
      }
    }
  }, [accData]);

  useEffect(() => {
    if (gyroDataChartRef.current) {
      const now = Date.now();
      if (now - lastScrollRef.current > 400) {
        gyroDataChartRef.current.scrollToEnd({ animated: false });
        lastScrollRef.current = now;
      }
    }
  }, [gyroData]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={['#153B2E', '#356B59', '#D7C1A6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#F7F0E8" />
          </TouchableOpacity>

          <CsvShareButton onPress={share} sharing={sharing} />
        </View>

        <Text style={styles.eyebrow}>IMU live view</Text>
        <Text style={styles.heroTitle}>Motion and orientation telemetry in one place.</Text>
        <Text style={styles.heroSubtitle}>
          Track acceleration and quaternion streams in real time with the same visual language as
          the rest of the dashboard.
        </Text>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="analytics-outline" size={15} color="#153B2E" />
            <Text style={styles.metaPillText}>2 live charts</Text>
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
          <Text style={styles.summaryLabel}>Accelerometer axes</Text>
          <Text style={styles.summaryValue}>X / Y / Z</Text>
          <Text style={styles.summaryHint}>Gravity-including acceleration in g</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Quaternion axes</Text>
          <Text style={styles.summaryValue}>X / Y / Z / W</Text>
          <Text style={styles.summaryHint}>Normalized rotation data</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#153B2E" />
          <Text style={styles.loadingTitle}>Waiting for IMU packets</Text>
          <Text style={styles.loadingText}>Charts will populate as soon as telemetry arrives.</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Acceleration</Text>
                <Text style={styles.sectionCaption}>Live accelerometer stream across three axes.</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>±8 g</Text>
              </View>
            </View>

            <Legend
              items={[
                { label: 'X', color: 'red' },
                { label: 'Y', color: 'green' },
                { label: 'Z', color: 'black' },
              ]}
            />

            <View style={styles.chartWrap}>
              <LineChart
                scrollRef={accChartRef}
                width={CHART_WIDTH}
                showScrollIndicator={true}
                hideDataPoints
                isAnimated={false}
                initialSpacing={0}
                spacing={1}
                maxValue={8}
                mostNegativeValue={-8}
                endSpacing={0}
                data={accData.x}
                data2={accData.y}
                data3={accData.z}
                color1="red"
                color2="green"
                color3="black"
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Gyro</Text>
                <Text style={styles.sectionCaption}>Quaternion-derived orientation values.</Text>
              </View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>-1 to 1.5</Text>
              </View>
            </View>

            <Legend
              items={[
                { label: 'X', color: 'red' },
                { label: 'Y', color: 'green' },
                { label: 'Z', color: 'blue' },
                { label: 'W', color: 'black' },
              ]}
            />

            <View style={styles.chartWrap}>
              <LineChart
                scrollRef={gyroDataChartRef}
                width={CHART_WIDTH}
                height={200}
                isAnimated={false}
                showScrollIndicator={true}
                maxValue={1.5}
                mostNegativeValue={-1}
                hideDataPoints
                spacing={1}
                initialSpacing={0}
                endSpacing={0}
                data={gyroData.x}
                data2={gyroData.y}
                data3={gyroData.z}
                data4={gyroData.w}
                color1="red"
                color2="green"
                color3="blue"
                color4="black"
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
  backButton: {
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
  chartWrap: {
    marginTop: 6,
    marginHorizontal: -6,
  },
});
