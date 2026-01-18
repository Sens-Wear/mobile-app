import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Progress from 'react-native-progress';

const sensors = [
  { id: '1', name: 'PPG', icon: require('@/assets/images/dashboard_icons/heart_rate.png'), link: '/ppg' },
  { id: '2', name: 'IMU', icon: require('@/assets/images/dashboard_icons/imu.png'), link: '/imu' },
  { id: '3', name: 'Temperature', icon: require('@/assets/images/dashboard_icons/temperature.png'), link: '/temperature' },
  { id: '4', name: 'Touch', icon: require('@/assets/images/dashboard_icons/touch.png'), link: '/touch' },
  { id: '5', name: 'LED', icon: require('@/assets/images/dashboard_icons/led.png'), link: '/led' },
  { id: '6', name: 'Vibration', icon: require('@/assets/images/dashboard_icons/vibration.png'), link: '/vibration' },
];

export default function SensorsScreen() {
  const router = useRouter();
  const batteryStatus = {
    level: 0.20,
    status: 'charging',
    statusCircleColor: 'rgba(0, 14, 213, 1)',
    // statusCircleColor: 'rgba(0, 122, 59, 1)',
    // statusCircleColor: 'rgba(122, 0, 0, 1)',
  };

  const handleSelectSensor = (pathName) => {
    router.push({ pathname: pathName });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}></View>
        <View style={styles.headerCenter}>
          <Image source={require('@/assets/images/logo.jpg')} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.headerRight}>
          <Progress.Circle
            size={30}
            indeterminate={false}
            progress={batteryStatus.level}
            showsText={true}
            textStyle={{fontSize: 15}}
            thickness={2}
            color={batteryStatus.statusCircleColor}
            formatText= {progress => `⚡︎`}
          />
        </View>
      </View>

      {/* Sensor List */}
      <FlatList
        data={sensors}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.sensorList}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.sensorItem} onPress={() => handleSelectSensor(item.link)}>
            <Image source={item.icon} style={styles.logo} resizeMode="contain" />
            <Text style={styles.sensorName}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
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
  logo: {
    width: 100,
    height: 30,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    justifyContent: 'flex-end',
  },
  batteryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sensorList: {
    padding: 20,
  },
  sensorItem: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    padding: 16,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  sensorName: {
    fontSize: 16,
    fontWeight: '500',
  },
});
