import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.renakoni.marktextandroid',
  appName: 'MarkText',
  webDir: 'dist',
  android: {
    // The bundle targets Vite's baseline-widely-available (Chrome 111);
    // older System WebViews fail at JS parse time, so gate them to the
    // static error page below instead of a blank screen (#158).
    minWebViewVersion: 111
  },
  server: {
    errorPath: 'webview-error.html'
  }
};

export default config;
