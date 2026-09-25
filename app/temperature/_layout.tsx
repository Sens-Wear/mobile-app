import React from 'react'
import { Slot } from 'expo-router'
import { FeatureGate } from '@/components/FeatureGate'
import { CsvLogProvider } from '@/hooks/useCsvExport'

export default function Layout() {
  return <CsvLogProvider><FeatureGate moduleKey="Temperature"><Slot /></FeatureGate></CsvLogProvider>
}
