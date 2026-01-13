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
  const [heartRateData, setHeartRateData] = useState([]);
  const [rawData, setRawdata] = useState({
    red: [],
    green: [],
    ir: [],
  });
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const router = useRouter();
  const heartRateChartRef = useRef(null)
  const rawDataChartRef = useRef(null)

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      router.replace('/'); // or wherever your "home" screen is
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setRawdata(prevData => {
        const updatedData = {
          red: [...prevData.red, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.red.length + 1}`
          }],
          green: [...prevData.green, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.green.length + 1}`
          }],
          ir: [...prevData.ir, {
            value: Math.floor(Math.random() * 100),
            label: `${prevData.ir.length + 1}`
          }],
        };
        // Trim older items if the new list is longer than MAX_LENGTH
        if (updatedData.red.length > MAX_LENGTH) {
          updatedData.red = updatedData.red.slice(updatedData.red.length - MAX_LENGTH);
          updatedData.green = updatedData.green.slice(updatedData.green.length - MAX_LENGTH);
          updatedData.ir = updatedData.ir.slice(updatedData.ir.length - MAX_LENGTH);
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
      setHeartRateData(prevData => {
        const updatedData = [...prevData, {
          value: Math.floor(Math.random() * 100), // Random value for demonstration
          label: `${prevData.length + 1}`
        }];
        // Trim older items if the new list is longer than MAX_LENGTH
        if (updatedData.length > MAX_LENGTH) {
          return updatedData.slice(updatedData.length - MAX_LENGTH);
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
    if (heartRateChartRef.current) {
      heartRateChartRef.current.scrollToEnd({ animated: true });
    }
  }, [heartRateData]);

  useEffect(() => {
    if (rawDataChartRef.current) {
      rawDataChartRef.current.scrollToEnd({ animated: true });
    }
  }, [rawData]);


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
              <Text style={styles.dividerText}>Heart Rate</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <LineChart
            scrollRef={heartRateChartRef}
            width={Dimensions.get('window').width - 70}
            hideDataPoints
            initialSpacing={0}
            endSpacing={0}
            data={heartRateData}
            color='green'
            curved
          />
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLeftSideLine} />
            <View>
              <Text style={styles.dividerText}>Raw Data</Text>
            </View>
            <View style={styles.dividerRightSideLine} />
          </View>
          <Legend />
          <LineChart
            scrollRef={rawDataChartRef}
            width={Dimensions.get('window').width - 70}
            hideDataPoints
            initialSpacing={0}
            endSpacing={0}
            data={rawData.red}
            data2={rawData.green}
            data3={rawData.ir}
            color1="red"
            color2="green"
            color3="black"
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
    marginBottom: 20,
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