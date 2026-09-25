import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { isSensorModuleAvailable } from '@/ble/daughterBoardState'
import type { SensorModuleKey } from '@/constants/DaughterBoardConstants'
import { useBle } from '@/hooks/BleSessionProvider'
import { useFocusedDaughterBoardState } from '@/hooks/useFocusedDaughterBoardState'

export function FeatureGate({ moduleKey, children }: {
  moduleKey: SensorModuleKey
  children: React.ReactNode
}) {
  const router = useRouter()
  const { isConnected, isLoadingDeviceInfo, capabilities, refreshDeviceInfo } = useBle()
  const state = useFocusedDaughterBoardState()
  if (isSensorModuleAvailable(moduleKey, state)) return <>{children}</>

  const message = !isConnected ? 'Connect to your SensWear device to use this module.'
    : isLoadingDeviceInfo ? 'Checking firmware support…'
      : !capabilities ? 'Firmware capabilities are unavailable. Refresh or update the firmware.'
        : 'This module is not supported by the running firmware and its enabled shields.'
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{moduleKey} unavailable</Text>
      <Text style={styles.message}>{message}</Text>
      {isLoadingDeviceInfo && <ActivityIndicator />}
      {isConnected && !isLoadingDeviceInfo && !capabilities && (
        <Pressable accessibilityRole="button" onPress={refreshDeviceInfo} style={styles.button}>
          <Text style={styles.buttonText}>Refresh firmware information</Text>
        </Pressable>
      )}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/sensors')} style={styles.button}>
        <Text style={styles.buttonText}>Back to sensors</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, gap: 18, backgroundColor: '#F5EFE8' },
  title: { fontSize: 24, fontWeight: '700', color: '#153B2E' },
  message: { fontSize: 16, lineHeight: 24, color: '#425049' },
  button: { padding: 14, borderRadius: 20, backgroundColor: '#153B2E' },
  buttonText: { color: '#FFF9F2', textAlign: 'center', fontWeight: '700' },
})
