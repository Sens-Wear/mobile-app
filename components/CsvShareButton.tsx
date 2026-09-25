import React from 'react'
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export function CsvShareButton({ onPress, sharing = false }: { onPress: () => Promise<void>; sharing?: boolean }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share CSV"
    accessibilityHint="Export recorded samples and interactions" disabled={sharing}
    onPress={() => { void onPress() }} style={styles.button}>
    {sharing ? <ActivityIndicator size="small" color="#F7F0E8" />
      : <Ionicons name="share-outline" size={18} color="#F7F0E8" />}
  </TouchableOpacity>
}

export function CsvExportHint() {
  return <Text style={styles.hint}>CSV keeps the latest 20,000 records from this visit.</Text>
}

const styles = StyleSheet.create({
  button: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  hint: { color: '#5F6B65', fontSize: 12, lineHeight: 18, marginTop: 12 },
})
