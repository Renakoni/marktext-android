import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

/**
 * Capacitor 8 core's built-in `SystemBars` plugin owns Android edge-to-edge
 * insets (it pads the WebView for the status bar and the IME) and exposes
 * `setStyle` for system-bar icon appearance.
 *
 * Do NOT add `@capacitor/status-bar` for this: its load-time
 * `overlaysWebView: true` default applies legacy fullscreen layout flags that
 * defeat the core insets handling — the top bar slides under the status bar
 * and `adjustResize` keyboard handling stops working.
 */

export function isSystemBarStyleAvailable() {
  return Capacitor.isNativePlatform()
}

/**
 * Keep Android system-bar icon contrast in sync with the applied app theme.
 * `Dark` means "dark bar" (light icons), so it pairs with dark themes;
 * omitting `bar` updates the status bar and gesture bar together.
 */
export async function applySystemBarsForTheme(darkTheme: boolean): Promise<boolean> {
  if (!isSystemBarStyleAvailable()) {
    return false
  }

  try {
    await SystemBars.setStyle({
      style: darkTheme ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    })
    return true
  } catch {
    return false
  }
}
