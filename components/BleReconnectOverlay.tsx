import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

export function BleReconnectOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.card}>
        <ActivityIndicator size="large" color="#F7F0E8" />
        <Text style={styles.title}>Reconnecting to device</Text>
        <Text style={styles.text}>
          The Bluetooth connection was interrupted. SensWear will keep retrying in the background.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'rgba(20, 37, 31, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#153B2E',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  title: {
    color: '#FDF9F4',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 16,
  },
  text: {
    color: '#D8E1DB',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
})
