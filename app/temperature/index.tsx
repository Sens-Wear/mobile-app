import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { decode as b64decode } from 'base-64';
import Legend from '@/components/ui/Legend';
import { TEMPERATURE_UUIDS } from '@/ble/bleConstants';
import { useBle } from '@/hooks/BleSessionProvider';

const MAX_LENGTH = 100;
const BUFFER_LIMIT = 100;

type ChartPoint = { value: number };

export default function TemperatureScreen() {
  const { isConnected, monitor, readCharacteristic } = useBle();
  const [temperatureData, setTemperatureData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const chartRef = useRef<any>(null);
  const lastScrollRef = useRef(0);
  const temperatureBufferRef = useRef<number[]>([]);

  const currentTemperature = temperatureData.length > 0
    ? temperatureData[temperatureData.length - 1].value
    : null;

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

    // Temperature notifications are sent as int32_t in deci-degrees Celsius.
    let temperature = readInt32LE(bytes, 0) / 1000;
    console.log(temperature)
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>Temperature</Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <ScrollView style={styles.mainContainer}>
          <View style={styles.currentValueCard}>
            <Text style={styles.currentValueLabel}>Current reading</Text>
            <Text style={styles.currentValueText}>
              {currentTemperature === null ? '--' : `${currentTemperature.toFixed(1)} °C`}
            </Text>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerSideLine} />
            <View>
              <Text style={styles.dividerText}>Temperature Chart</Text>
            </View>
            <View style={styles.dividerSideLine} />
          </View>

          <Legend
            items={[
              { label: 'Temperature', color: '#e67e22' },
            ]}
          />

          <LineChart
            scrollRef={chartRef}
            width={Dimensions.get('window').width - 70}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  currentValueCard: {
    marginTop: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f6f6f6',
    alignItems: 'center',
  },
  currentValueLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  currentValueText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  dividerSideLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'black',
  },
  dividerText: {
    width: 140,
    textAlign: 'center',
    fontSize: 15,
  },
});
