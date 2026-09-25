import * as Application from 'expo-application'
import Constants from 'expo-constants'

// Native binary metadata is authoritative; Expo config is the development/web fallback.
export function getAppVersion() {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? 'Unknown'
}
