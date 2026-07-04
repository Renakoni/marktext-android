import { Capacitor, registerPlugin } from '@capacitor/core'

interface NativeAdvancedDiagnostics {
  deviceInfo: string
  webViewInfo: string
}

interface AndroidAppInfoPlugin {
  getDiagnostics(): Promise<NativeAdvancedDiagnostics>
}

const AndroidAppInfo = registerPlugin<AndroidAppInfoPlugin>('AndroidAppInfo')

function getBrowserDiagnostics(): NativeAdvancedDiagnostics {
  return {
    deviceInfo: Capacitor.getPlatform(),
    webViewInfo: navigator.userAgent,
  }
}

export async function getAdvancedDiagnostics(): Promise<NativeAdvancedDiagnostics> {
  if (Capacitor.getPlatform() !== 'android' || !Capacitor.isNativePlatform()) {
    return getBrowserDiagnostics()
  }

  try {
    return await AndroidAppInfo.getDiagnostics()
  } catch {
    return getBrowserDiagnostics()
  }
}
