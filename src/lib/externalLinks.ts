import { AppLauncher } from '@capacitor/app-launcher'
import { getOpenableLinkTarget } from '../features/editor/linkTargets'

// Hand a link to the Android system (default browser / mail / dialer) via
// AppLauncher. The scheme allowlist is re-checked HERE as defense in depth:
// even if a caller passes something the overlay would not have shown, an
// unsafe scheme (`javascript:`/`file:`/`intent:`) never reaches the launcher.
// On the web (dev/e2e) AppLauncher's implementation routes through
// `window.open`; the catch keeps a hard failure from surfacing as an
// unhandled rejection.
export async function openExternalUrl(url: string): Promise<boolean> {
  const target = getOpenableLinkTarget(url)
  if (!target) {
    return false
  }

  try {
    const { completed } = await AppLauncher.openUrl({ url: target })
    return completed
  } catch {
    return false
  }
}
