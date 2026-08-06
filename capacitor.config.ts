import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.renakoni.marktextandroid',
  appName: 'MarkText',
  webDir: 'dist',
  android: {
    // The bundle targets Vite's baseline-widely-available (Chrome 111);
    // older System WebViews fail at JS parse time, so gate them to the
    // static error page below instead of a blank screen (#158).
    // This gate only understands standard WebView version schemes; Huawei
    // WebView is versioned independently, so index.html additionally checks
    // the real Chromium core version from the user agent and redirects to
    // the same error page.
    minWebViewVersion: 111
  },
  server: {
    errorPath: 'webview-error.html'
  }
};

export default config;
