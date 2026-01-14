import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from "react-native-gifted-charts";
import { Dimensions } from 'react-native';
import { decode as b64decode } from 'base-64';
import { IMU_UUIDS } from '@/ble/bleConstants';
import Legend from '@/components/ui/Legend';
import { useBle } from '@/hooks/BleSessionProvider';
import { IMU_CONSTANTS } from '@/constants/SensorConstants';



const MAX_LENGTH = 500; // Maximum number of items to keep in the chart
const BUFFER_LIMIT = 500; // Prevent unbounded growth if UI updates are delayed

export default function DevicesScreen() {
  const { monitor } = useBle();
  const [accData, setAccData] = useState({
    x: [],
    y: [],
    z: [],
  });
  const [gyroData, setGyroData] = useState({
    x: [],
    y: [],
    z: [],
    w: [],
  });
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const router = useRouter();
  const accChartRef = useRef(null)
  const gyroDataChartRef = useRef(null)
  const accBufferRef = useRef<{ x: number; y: number; z: number }[]>([]);
  const gyroBufferRef = useRef<{ x: number; y: number; z: number; w: number }[]>([]);

  function base64ToBytes(base64: string) {
    const binary = b64decode(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function readInt16LE(bytes: Uint8Array, offset: number) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getInt16(offset, true);
  }

  useFocusEffect(
    React.useCallback(() => {
      const accSub = monitor(IMU_UUIDS.SERVICE_UUID, IMU_UUIDS.ACCELEROMETER_CHAR, (c) => {
        const v = c.value;
        if (!v) return;
        const bytes = base64ToBytes(v);
        if (bytes.length < 6) return;
        let dataToPush = {
          x: readInt16LE(bytes, 0),
          y: readInt16LE(bytes, 2),
          z: readInt16LE(bytes, 4),
        };
        accBufferRef.current.push(dataToPush);
        if (accBufferRef.current.length > BUFFER_LIMIT) {
          accBufferRef.current.splice(0, accBufferRef.current.length - BUFFER_LIMIT);
        }
      }, (e) => {
        console.log(e)
      });

      const gyroSub = monitor(IMU_UUIDS.SERVICE_UUID, IMU_UUIDS.QUATERNION_CHAR, (c) => {
        const v = c.value;
        if (!v) return;
        const bytes = base64ToBytes(v);
        if (bytes.length < 10) return;
        let dataToPush = {
          x: readInt16LE(bytes, 0) / IMU_CONSTANTS.QUATERNION_DIVISION,
          y: readInt16LE(bytes, 2) / IMU_CONSTANTS.QUATERNION_DIVISION,
          z: readInt16LE(bytes, 4) / IMU_CONSTANTS.QUATERNION_DIVISION,
          w: readInt16LE(bytes, 6) / IMU_CONSTANTS.QUATERNION_DIVISION,
        };
        gyroBufferRef.current.push(dataToPush);
        if (gyroBufferRef.current.length > BUFFER_LIMIT) {
          gyroBufferRef.current.splice(0, gyroBufferRef.current.length - BUFFER_LIMIT);
        }
      }, (e) => {
        console.log(e)
      });
      const interval = setInterval(() => {
        const accBatch = accBufferRef.current.splice(0);
        const gyroBatch = gyroBufferRef.current.splice(0);
        if (accBatch.length === 0 && gyroBatch.length === 0) return;

        if (accBatch.length > 0) {
          setAccData(prevData => {
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
          setGyroData(prevData => {
            const x = [...prevData.x];
            const y = [...prevData.y];
            const z = [...prevData.z];
            const w = [...prevData.w];
            for (const sample of gyroBatch) {
              x.push({ value: sample.x});
              y.push({ value: sample.y});
              z.push({ value: sample.z});
              w.push({ value: sample.w});
            }
            return {
              x: x.slice(-MAX_LENGTH),
              y: y.slice(-MAX_LENGTH),
              z: z.slice(-MAX_LENGTH),
              w: w.slice(-MAX_LENGTH),
            };
          });
        }
        setLoading(false);
      }, 1000);

      return () => {
        accSub.remove();
        gyroSub.remove();
        clearInterval(interval);
        accBufferRef.current = [];
        gyroBufferRef.current = [];
      };
    }, [monitor])
  );

  useEffect(() => {
    if (accChartRef.current) {
      accChartRef.current.scrollToEnd({ animated: true });
    }
  }, [accData]);

  useEffect(() => {
    if (gyroDataChartRef.current) {
      gyroDataChartRef.current.scrollToEnd({ animated: true });
    }
  }, [gyroData]);


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerLeft}>
          <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>IMU</Text>
        </View>

        <View style={styles.headerRight}>
          {/* <Image source={require('@/assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" /> */}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" />
      ) : (
        <ScrollView style={styles.mainContainer}>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>Acceleration</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend
            items={[
              { label: 'X', color: 'lime' },
              { label: 'Y', color: 'red' },
              { label: 'Z', color: 'black' },
            ]}
          />
          <LineChart
            scrollRef={accChartRef}
            width={Dimensions.get('window').width - 70}
            height={200}
            showScrollIndicator={true}
            hideDataPoints
            initialSpacing={0}
            spacing={1}
            endSpacing={0}
            data={accData.x}
            data2={accData.y}
            data3={accData.z}
            color1="red"
            color2="green"
            color3="black"
            curved
          />
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>Gyro</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend
            items={[
              { label: 'X', color: 'lime' },
              { label: 'Y', color: 'red' },
              { label: 'Z', color: 'blue' },
              { label: 'W', color: 'black' },
            ]}
          />
          <LineChart
            scrollRef={gyroDataChartRef}
            width={Dimensions.get('window').width - 70}
            height={200}
            showScrollIndicator={true}
            maxValue={1}
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
            curved
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
