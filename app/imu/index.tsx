import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from "react-native-gifted-charts";
import { Dimensions } from 'react-native';
import Legend from '../../components/ui/Legend';



const MAX_LENGTH = 100; // Maximum number of items to keep in the chart

export default function DevicesScreen() {
  const [accRateData, setAccRateData] = useState({
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
  const accRateChartRef = useRef(null)
  const gyroDataChartRef = useRef(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setGyroData(prevData => {
        const updatedData = {
          x: [...prevData.x, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.x.length + 1}`
          }],
          y: [...prevData.y, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.y.length + 1}`
          }],
          z: [...prevData.z, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.z.length + 1}`
          }],
          w: [...prevData.w, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.w.length + 1}`
          }],
        };
        // Trim older items if the new list is longer than MAX_LENGTH
        if (updatedData.x.length > MAX_LENGTH) {
          updatedData.x = updatedData.x.slice(updatedData.x.length - MAX_LENGTH);
          updatedData.y = updatedData.y.slice(updatedData.y.length - MAX_LENGTH);
          updatedData.z = updatedData.z.slice(updatedData.z.length - MAX_LENGTH);
          updatedData.w = updatedData.w.slice(updatedData.w.length - MAX_LENGTH);
        }
        return updatedData;
      });
      setLoading(false);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAccRateData(prevData => {
        const updatedData = {
          x: [...prevData.x, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.x.length + 1}`
          }],
          y: [...prevData.y, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.y.length + 1}`
          }],
          z: [...prevData.z, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.z.length + 1}`
          }]
        };
        // Trim older items if the new list is longer than MAX_LENGTH
        if (updatedData.x.length > MAX_LENGTH) {
          updatedData.x = updatedData.x.slice(updatedData.x.length - MAX_LENGTH);
          updatedData.y = updatedData.y.slice(updatedData.y.length - MAX_LENGTH);
          updatedData.z = updatedData.z.slice(updatedData.z.length - MAX_LENGTH);
        }
        return updatedData;
      });
      setLoading(false);
    }, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (accRateChartRef.current) {
      accRateChartRef.current.scrollToEnd({ animated: true });
    }
  }, [accRateData]);

  useEffect(() => {
    if (gyroDataChartRef.current) {
      gyroDataChartRef.current.scrollToEnd({ animated: true });
      accRateChartRef.current.scrollToEnd({ animated: true });
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
            scrollRef={accRateChartRef}
            width={Dimensions.get('window').width - 70}
            hideDataPoints
            initialSpacing={0}
            endSpacing={0}
            data={gyroData.x}
            data2={gyroData.y}
            data3={gyroData.z}
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
            hideDataPoints
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
