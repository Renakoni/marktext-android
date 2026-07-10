# MarkText for Android

Android app scaffold for a MarkText-like editor. The first version uses Vue, Vite, Capacitor Android, and `@muyajs/core` so the Markdown editing core stays close to MarkText/Muya instead of being rewritten in a native UI toolkit.

## Stack

- Vue 3 + Vite for the web shell.
- Capacitor Android for the native Android project.
- `@muyajs/core` for the Markdown editor.

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm test:muya
pnpm test:e2e
pnpm lint
pnpm typecheck
pnpm build
pnpm android:sync
pnpm android:open
pnpm logs:android
```

`pnpm test` runs the app unit tests, `pnpm test:muya` runs the vendored editor-core
gate, and `pnpm test:e2e` runs the mobile WebView journeys in Playwright.
`pnpm lint` runs ESLint. `pnpm typecheck` runs `vue-tsc`.
`pnpm android:sync` builds the web app and copies it into the Android project. Use `pnpm android:open` to open the generated Android project in Android Studio.
`pnpm logs:android` captures MuMu/ADB diagnostics into the ignored local `logs/` directory.

## Debug Logging

The app writes categorized, timestamped runtime logs from the web shell to:

- Browser/WebView console.
- Android logcat with tag `MarkTextAndroid`.
- The app private Android directory `files/logs/marktext-android-YYYY-MM-DD.log`.
- A bounded in-browser local log buffer for developer diagnostics.

Markdown document text is not written to logs. Editor logs use metadata such as character count, word count, line count, event name, and error details.

Capture a local diagnostics bundle:

```powershell
pnpm logs:android
```

By default this connects to MuMu at `127.0.0.1:7555`, captures filtered `MarkTextAndroid` logcat output, captures Android error logs, lists app private log files, and copies readable app private logs into `logs/android-YYYY-MM-DD_HH-mm-ss/`.

Useful direct MuMu/ADB commands:

```powershell
& 'E:\Android\Sdk\platform-tools\adb.exe' -s 127.0.0.1:7555 logcat -c
& 'E:\Android\Sdk\platform-tools\adb.exe' -s 127.0.0.1:7555 logcat -s MarkTextAndroid:*
& 'E:\Android\Sdk\platform-tools\adb.exe' -s 127.0.0.1:7555 shell run-as io.github.renakoni.marktextandroid ls -la files/logs
$day = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
& 'E:\Android\Sdk\platform-tools\adb.exe' -s 127.0.0.1:7555 shell run-as io.github.renakoni.marktextandroid cat "files/logs/marktext-android-$day.log"
```

For host-side captures, write output under the local `logs/` directory; it is ignored by Git.

## GitHub Workflow

This repository keeps a small Android-specific CI setup inspired by upstream MarkText's `.github/workflows` structure:

- `.github/actions/setup/action.yml` installs pnpm, Node.js, and dependencies.
- `.github/workflows/web-quality.yml` runs ESLint, TypeScript typecheck, and the Vite production build.
- `.github/workflows/android-debug.yml` runs Capacitor sync and Gradle `assembleDebug`.
- `.github/workflows/dependency-review.yml` reviews `package.json` and `pnpm-lock.yaml` changes on pull requests.
- Successful Android debug runs upload `android/app/build/outputs/apk/debug/app-debug.apk` as a short-lived artifact.

The upstream desktop/Electron build workflows are intentionally not copied. This project validates the Android web shell with unit, Muya, and Playwright suites plus the Capacitor Android debug build; release signing, Android device smoke tests, and license validation can be added when those surfaces exist.
