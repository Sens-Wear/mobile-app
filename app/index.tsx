import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Image, TouchableOpacity, StatusBar } from 'react-native';
import { useBle } from '../hooks/BleSessionProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { autoConnect } = useBle();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const device = await autoConnect();
        if (!cancelled && device) {
          router.replace({
            pathname: '/sensors',
            params: { deviceId: device.id },
          });
        }
      } catch (e) {
        // optional: handle error or route to pairing
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Ring image */}
      <Image
        source={require('@/assets/images/home-page-bg.png')}
        style={styles.ringImage}
        resizeMode="cover"
      />

      {/* Text & Buttons */}
      <View style={styles.overlay}>
        <Text style={styles.title}>SENSWEAR{'\n'}PLATFORM</Text>

        <TouchableOpacity style={styles.button} onPress={() => router.push({ pathname: '/pairing' })}>
          <Text style={styles.buttonText}>Get started</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>No SensWear platform yet?</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By registering, you agree with the <Text style={styles.underline}>terms</Text> &{' '}
          <Text style={styles.underline}>conditions</Text> of SensWear
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e3d2bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginBottom: 15,
    width: '100%',
  },
  buttonText: {
    textAlign: 'center',
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  secondaryButton: {
    marginBottom: 20,
  },
  secondaryText: {
    color: '#fff',
    fontSize: 15,
  },
  termsText: {
    color: '#fff',
    fontSize: 11,
    textAlign: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});