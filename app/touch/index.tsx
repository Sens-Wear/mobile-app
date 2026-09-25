import React from 'react'
import { useRouter } from 'expo-router'
import { TouchDemoView } from '@/components/TouchDemoView'
import { useTouchDemo } from '@/hooks/useTouchDemo'

export default function TouchScreen() {
  const router = useRouter()
  const demo = useTouchDemo()
  return <TouchDemoView demo={demo} onBack={() => router.back()} />
}
