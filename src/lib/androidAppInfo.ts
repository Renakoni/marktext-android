import { Capacitor, registerPlugin } from '@capacitor/core'

export interface NativeAdvancedDiagnostics {
  deviceInfo: string
  webViewInfo: string
  manufacturer?: string
}

export interface NativeLatestRelease {
  tagName: string
  releaseUrl: string
}

interface AndroidAppInfoPlugin {
  getDiagnostics(): Promise<NativeAdvancedDiagnostics>
  getLatestRelease(): Promise<NativeLatestRelease>
}

/** Single registration point — Capacitor rejects duplicate plugin names. */
export const AndroidAppInfo = registerPlugin<AndroidAppInfoPlugin>('AndroidAppInfo')

export function isAndroidAppInfoAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform()
}
