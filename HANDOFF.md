# Handoff

## Project

- Local path: `E:\marktext_for_android`
- Recommended GitHub repository name: `marktext-android`
- Current npm package name: `marktext-for-android`
- Android app id: `io.github.renakoni.marktextandroid`
- Android app name: `MarkText for Android`

Prefer `marktext-android` for GitHub. It is short, lowercase, URL-friendly, and matches common GitHub naming better than `markText_for_android`. Keep `marktext_for_android` only as the local folder name if desired.

## Current Stack

- Vue 3 + Vite for the web app shell.
- Capacitor Android for the generated Android project.
- `@muyajs/core` for the Markdown editor core, so the app stays close to MarkText/Muya instead of rewriting Markdown editing in Flutter or native Android.

Flutter is not the recommended base for this project because it would make MarkText/Muya reuse much harder. The current direction is a WebView-based Android app with native capabilities added through Capacitor plugins when needed.

## Current State

- Vite/Vue starter UI has been replaced with a real editor shell in `src/App.vue`.
- `@muyajs/core/lib/core.css` is imported from `src/main.ts`.
- The app mounts Muya, registers basic editor UI plugins, loads sample Markdown, and supports local draft save, copy Markdown, reset sample, and export HTML.
- `vite.config.ts` uses `base: './'` so bundled assets work from Capacitor's local Android WebView.
- `pnpm build` passed.
- `pnpm exec cap sync android` passed.
- A local Vite dev server was started during setup at `http://127.0.0.1:5173/`. Treat it as disposable; restart it in the next session if needed.

## Verification Already Done

```sh
pnpm build
pnpm exec cap sync android
```

Manual/browser check:

- Opened `http://127.0.0.1:5173/`.
- Confirmed the Muya editor renders.
- Confirmed no browser console warnings or errors were reported at page load.
- Checked desktop viewport rendering through Playwright MCP.

Known build note:

- The production build warns about large chunks. This is expected for the current baseline because `@muyajs/core` pulls in Prism, Mermaid, KaTeX, and related editor/rendering dependencies. Do not treat this as a correctness failure. Bundle splitting and feature trimming belong in a later optimization pass.

## Git / Repo Notes

This directory is not currently initialized as a Git repository. Suggested initial repository flow:

```sh
Set-Location -LiteralPath 'E:\marktext_for_android'
git init
git add .
git commit -m "chore: scaffold marktext android app"
git branch -M main
git remote add origin "https://github.com/<your-account>/marktext-android.git"
git push -u origin main
```

The `.gitignore` intentionally ignores:

- `dist/`
- Vite/dev logs
- `.playwright-mcp/`
- Android/Gradle build outputs
- Capacitor generated web assets under `android/app/src/main/assets/public/`
- generated `android/app/src/main/assets/capacitor.config.json`

Before building or opening Android Studio, regenerate native web assets with:

```sh
pnpm android:sync
```

## Licensing And Branding

MarkText and Muya are MIT-licensed, so reuse is legally practical if copyright and license notices are preserved. Still, avoid implying this is an official MarkText Android app unless the MarkText maintainers agree. If the app will use the MarkText name/logo prominently, open a discussion/RFC with the MarkText project first.

## Next Session Starting Point

Start by running:

```sh
Set-Location -LiteralPath 'E:\marktext_for_android'
pnpm install
pnpm dev --host 127.0.0.1 --port 5173
```

Then inspect:

- `src/App.vue`
- `src/style.css`
- `capacitor.config.ts`
- `todolist.md`

The next real engineering step should be Android file access and document persistence, not visual polish.
