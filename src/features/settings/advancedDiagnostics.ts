import { Capacitor } from '@capacitor/core'
import {
  AndroidAppInfo,
  isAndroidAppInfoAvailable,
  type NativeAdvancedDiagnostics,
} from '../../lib/androidAppInfo'

function getBrowserDiagnostics(): NativeAdvancedDiagnostics {
  return {
    deviceInfo: Capacitor.getPlatform(),
    webViewInfo: navigator.userAgent,
  }
}

export async function getAdvancedDiagnostics(): Promise<NativeAdvancedDiagnostics> {
  if (!isAndroidAppInfoAvailable()) {
    return getBrowserDiagnostics()
  }

  try {
    return await AndroidAppInfo.getDiagnostics()
  } catch {
    return getBrowserDiagnostics()
  }
}
