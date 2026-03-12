import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from "react-native-gifted-charts";
import { Dimensions } from 'react-native';
import Legend from '@/components/ui/Legend';
import { decode as b64decode } from 'base-64';
import { PPG_UUIDS } from '@/ble/bleConstants';
import { useBle } from '@/hooks/BleSessionProvider';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';



const MAX_LENGTH = 500; // Maximum number of items to keep in the chart
const BUFFER_LIMIT = 500; // Prevent unbounded growth if UI updates are delayed

export default function DevicesScreen() {
  const { monitor } = useBle();
  const [rawRedData, setRawRedData] = useState([]);
  const [rawIRData, setRawIRData] = useState([]);
  const [rawGreenData, setRawGreenData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isShareAvailable, setIsShareAvailable] = useState(false);
  const lastRedScrollRef = useRef(0);
  const lastIRScrollRef = useRef(0);
  const lastGreenScrollRef = useRef(0);
  const router = useRouter();
  const rawRedDataChartRef = useRef(null)
  const rawIRDataChartRef = useRef(null)
  const rawGreenDataChartRef = useRef(null)
  const rawGreenBufferRef = useRef<{ green: number }[]>([]);
  const csvRowsRef = useRef<string[]>([]);
  const csvUriRef = useRef<string | null>(null);
  const rawRedBufferRef = useRef<{ red: number }[]>([]);
  const rawIRBufferRef = useRef<{ ir: number }[]>([]);

  useEffect(() => {
    Sharing.isAvailableAsync()
      .then(setIsShareAvailable)
      .catch(() => setIsShareAvailable(false));
  }, []);

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

  function base64ToBytes(base64: string) {
    const binary = b64decode(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readUint32LE(bytes: Uint8Array, offset: number) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getUint32(offset, true);
  }

  function readUint64LEAsNumber(bytes: Uint8Array, offset: number) {
    const low = readUint32LE(bytes, offset);
    const high = readUint32LE(bytes, offset + 4);
    return high * 0x100000000 + low;
  }

  function parsePpgSampleBatchNotification(bytes: Uint8Array) {
    const SAMPLE_SIZE_BYTES = 12;
    const sampleCount = Math.floor(bytes.length / SAMPLE_SIZE_BYTES);
    if (sampleCount === 0) return [];

    const samples = [];
    for (let i = 0; i < sampleCount; i += 1) {
      const offset = i * SAMPLE_SIZE_BYTES;
      // Firmware sends packed struct as little-endian: uint64 unix_ms + uint32 value.
      samples.push({
        unixMs: readUint64LEAsNumber(bytes, offset),
        value: readUint32LE(bytes, offset + 8),
      });
    }
    return samples;
  }

  useFocusEffect(
      React.useCallback(() => {
        csvUriRef.current = FileSystem.documentDirectory + `ppg-${Date.now()}.csv`;
        csvRowsRef.current = ['timestamp_ms,channel,value'];
        const redSub = monitor(PPG_UUIDS.SERVICE_UUID, PPG_UUIDS.RED_CHANNEL_CHAR, (c) => {
          const v = c.value;
          if (!v) return;
          const bytes = base64ToBytes(v);
          const samples = parsePpgSampleBatchNotification(bytes);
          if (samples.length === 0) return;
          for (const sample of samples) {
            rawRedBufferRef.current.push({ red: sample.value });
            csvRowsRef.current.push(`${sample.unixMs},red,${sample.value}`);
          }
          if (rawRedBufferRef.current.length > BUFFER_LIMIT) {
            rawRedBufferRef.current.splice(0, rawRedBufferRef.current.length - BUFFER_LIMIT);
          }
        }, (e) => {
          console.log(e)
        });
  
        const irSub = monitor(PPG_UUIDS.SERVICE_UUID, PPG_UUIDS.IR_CHANNEL_CHAR, (c) => {
          const v = c.value;
          if (!v) return;
          const bytes = base64ToBytes(v);
          const samples = parsePpgSampleBatchNotification(bytes);
          if (samples.length === 0) return;
          console.log(`Received IR batch with ${samples.length} samples, first sample value: ${samples[0].value}`);
          for (const sample of samples) {
            rawIRBufferRef.current.push({ ir: sample.value });
            csvRowsRef.current.push(`${sample.unixMs},ir,${sample.value}`);
          }
          if (rawIRBufferRef.current.length > BUFFER_LIMIT) {
            rawIRBufferRef.current.splice(0, rawIRBufferRef.current.length - BUFFER_LIMIT);
          }
        }, (e) => {
          console.log(e)
        });

        const greenSub = monitor(PPG_UUIDS.SERVICE_UUID, PPG_UUIDS.GREEN_CHANNEL_CHAR, (c) => {
          const v = c.value;
          if (!v) return;
          const bytes = base64ToBytes(v);
          const samples = parsePpgSampleBatchNotification(bytes);
          if (samples.length === 0) return;
          for (const sample of samples) {
            rawGreenBufferRef.current.push({ green: sample.value });
            csvRowsRef.current.push(`${sample.unixMs},green,${sample.value}`);
          }
          if (rawGreenBufferRef.current.length > BUFFER_LIMIT) {
            rawGreenBufferRef.current.splice(0, rawGreenBufferRef.current.length - BUFFER_LIMIT);
          }
        }, (e) => {
          console.log(e)
        });
        
        const interval = setInterval(() => {
          const redBatch = rawRedBufferRef.current.splice(0);
          const irBatch = rawIRBufferRef.current.splice(0);
          const greenBatch = rawGreenBufferRef.current.splice(0);
          if (redBatch.length === 0 && irBatch.length === 0 && greenBatch.length == 0) return;
  
          if (redBatch.length > 0) {
            setRawRedData(prevData => {
              const red = [...prevData];
              for (const sample of redBatch) {
                red.push({ value: sample.red });
              }

              return red.slice(-MAX_LENGTH);
            });
          }

          if (irBatch.length > 0) {
            setRawIRData(prevData => {
              const ir = [...prevData];
              for (const sample of irBatch) {
                ir.push({ value: sample.ir });
              }

              return ir.slice(-MAX_LENGTH);
            });
          }

          if (greenBatch.length > 0) {
            setRawGreenData(prevData => {
              const green = [...prevData];
              for (const sample of greenBatch) {
                green.push({ value: sample.green });
              }
              return green.slice(-MAX_LENGTH);
            });
          }
          if (loading) {
            setLoading(false);
          }
        }, 500);
  
        return () => {
          redSub.remove();
          irSub.remove();
          greenSub.remove();
          clearInterval(interval);
          rawRedBufferRef.current = [];
          rawIRBufferRef.current = [];
          rawGreenBufferRef.current = [];
          if (csvUriRef.current && csvRowsRef.current.length > 1) {
            const contents = csvRowsRef.current.join('\n') + '\n';
            FileSystem.writeAsStringAsync(csvUriRef.current, contents, {
              encoding: FileSystem.EncodingType.UTF8,
            }).catch((e) => console.log(e));
          }
        };
      }, [monitor])
    );

  const shareCsv = async () => {
    if (!isShareAvailable || !csvUriRef.current || csvRowsRef.current.length <= 1) return;
    const contents = csvRowsRef.current.join('\n') + '\n';
    await FileSystem.writeAsStringAsync(csvUriRef.current, contents, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(csvUriRef.current, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Share PPG CSV',
    });
  };

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>PPG</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={shareCsv} disabled={!isShareAvailable}>
            <Ionicons name="share-outline" size={22} color={isShareAvailable ? "black" : "#aaa"} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <ScrollView style={styles.mainContainer}>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>Red Channel</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend
            items={[
              { label: 'Red', color: 'red' },
            ]}
          />
          <LineChart
            scrollRef={rawRedDataChartRef}
            width={Dimensions.get('window').width - 70}
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
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>IR Channel</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend
            items={[
              { label: 'IR', color: 'black' },
            ]}
          />
          <LineChart
            scrollRef={rawIRDataChartRef}
            width={Dimensions.get('window').width - 70}
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
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>Green Channel</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend
            items={[
              { label: 'Green', color: 'lime' },
            ]}
          />
          <LineChart
            scrollRef={rawGreenDataChartRef}
            width={Dimensions.get('window').width - 70}
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
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    backgroundColor: '#fff',
  },
  mainContainer: {
    paddingHorizontal: 20,
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 100,
    height: 30,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  deviceItem: {
    backgroundColor: '#f1f1f1',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 18,
    fontWeight: '500',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  dividerLeftSideLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black'
  },
  dividerRightSideLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black'
  },
  dividerText: {
    width: 100,
    textAlign: 'center',
    fontSize: 15
  }
});
