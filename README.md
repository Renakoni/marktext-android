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
pnpm build
pnpm android:sync
pnpm android:open
```

`pnpm android:sync` builds the web app and copies it into the Android project. Use `pnpm android:open` to open the generated Android project in Android Studio.
