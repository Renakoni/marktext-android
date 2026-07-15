<p align="center">
  <img src="docs/assets/logo.png" alt="MarkText for Android logo" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  A quiet, focused Markdown editor for Android —<br>
  the desktop <a href="https://github.com/marktext/marktext">MarkText</a> writing experience, shaped for the phone.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Android-7.0%2B-3ddc84.svg" alt="Android 7.0+">
  <img src="https://img.shields.io/badge/status-pre--release%200.1.0-orange.svg" alt="Pre-release 0.1.0">
</p>

<p align="center">
  <a href="#highlights">Highlights</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="#development">Development</a> ·
  <a href="#license--attribution">License</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Editing a Markdown document — light theme" width="248">
  &nbsp;
  <img src="docs/screenshots/theme-dark.png" alt="The same editor in a dark theme" width="248">
</p>

> **Unofficial community port.** Not affiliated with, endorsed by, or maintained
> by the MarkText team. It builds on and modifies MarkText's open-source editor
> core (Muya) for Android — see [License & attribution](#license--attribution).

## What it is

MarkText for Android brings MarkText's live-preview Markdown editing to a phone
without a native rewrite. Its editing core began as Muya — MarkText's open-source
engine — but is substantially reworked here: rebuilt for smooth performance on
large documents, re-laid-out to reclaim phone width, and extended with mobile
selection and toolbar behavior that never existed on desktop. What you write still
renders with the fidelity you expect from MarkText, in an interface shaped for
writing on the go.

The goal is simple: open a `.md` file, edit it, and never lose a word.

## Highlights

### A real Markdown editor, not a textarea

<table>
<tr>
<td valign="top">

- True live-preview (WYSIWYG) editing — the desktop MarkText writing experience,
  not a plain text box.
- CommonMark and GitHub Flavored Markdown, with math (KaTeX), diagrams, front
  matter, footnotes, tables, and syntax-highlighted code blocks.
- Document outline and in-document search, tuned to stay smooth in large files.
- Export to **PDF** and share straight to any Android app.

</td>
<td width="250"><img src="docs/screenshots/editor-rich.png" alt="Tables, code, and math rendered live while typing" width="250"></td>
</tr>
</table>

### Make it yours

<table>
<tr>
<td width="250"><img src="docs/screenshots/customize-toolbar.png" alt="Reordering commands on the custom quick toolbar" width="250"></td>
<td valign="top">

Customization is a first-class feature, not an afterthought:

- **Build your own toolbars.** Compose the bottom quick bar from a command pool
  and drag to reorder it. Even the floating selection toolbar — the clipboard bar
  that pops up over selected text — can carry your own extra commands, in one or
  two rows.
- **Toolbar behavior.** Docked, hidden, or compact; choose the default panel and
  whether the app remembers your last one.
- **Themes and type.** Light, dark, and custom themes (`ayu-light`, `one-dark`);
  adjustable font family, size, line height, line width, and text direction (LTR
  or RTL).
- **Markdown to your taste.** List markers and indentation, heading style, front
  matter format (YAML/TOML/JSON), footnotes, super/subscript, HTML rendering, and
  GitLab compatibility.
- **File-level control.** Per-document encoding, line endings, and trailing
  newline handling.

</td>
</tr>
</table>

### Your words stay safe

<table>
<tr>
<td valign="top">

- Autosave with a configurable delay, plus recovery drafts for interrupted
  sessions.
- **Atomic, all-or-nothing saves.** A file is replaced only once the full write
  succeeds; with backup and restore, an interrupted or failed save never leaves a
  half-written or corrupted document.
- Drafts are kept, not silently evicted.
- **Fully on-device.** No account, no cloud sync, no telemetry. Your document
  text is never written to logs.

</td>
<td width="250"><img src="docs/screenshots/home.png" alt="The home screen listing recent documents" width="250"></td>
</tr>
</table>

### Built for the phone

<table>
<tr>
<td width="250"><img src="docs/screenshots/export-pdf.png" alt="Exporting a document to PDF and sharing it" width="250"></td>
<td valign="top">

- Open and save real files through Android's Storage Access Framework.
- Handle incoming **open** and **share** intents from other apps.
- Comfortable one-handed touch targets and a calm, editor-first layout.
- Wide tables scroll within their own frame instead of shifting the whole page.

</td>
</tr>
</table>

### Polished and accessible

<table>
<tr>
<td valign="top">

- Restrained graphite design that stays out of the way of the text.
- WCAG 2.2 AA contrast, visible focus order, and respect for reduced-motion.
- **Ten languages** with automatic system-language selection: English, German,
  Spanish, French, Japanese, Korean, Portuguese, Turkish, and Simplified and
  Traditional Chinese.

</td>
<td width="250"><img src="docs/screenshots/cjk.png" alt="The editor showing a Chinese document with a Chinese interface" width="250"></td>
</tr>
</table>

### Lightweight

A focused Vue + Capacitor web shell rather than a heavy native stack. The debug
build is around 9.6 MB — a fraction of what many commercial Markdown apps ship,
and a shrunk release build is smaller still.

## Project status

This is a mature debug/beta build, **not yet a signed public release**. The
editor and its document-safety workflows are stable and well-tested, but the
release pipeline (app signing, published builds, and on-device release
verification) is still being finalized. Until then, the way to try it is to build
from source.

Signed builds will be published on the
[Releases](https://github.com/Renakoni/marktext-android/releases) page when ready.

## Build from source

Requirements:

- [Node.js](https://nodejs.org/) with [pnpm](https://pnpm.io/) (the repository
  pins the version via `packageManager`).
- [Android Studio](https://developer.android.com/studio) with an Android SDK
  (min API 24, target API 36) and a JDK.

```sh
pnpm install          # install dependencies
pnpm dev              # preview the web shell in a browser
pnpm android:sync     # build the web app and sync it into the Android project
pnpm android:open     # open the Android project in Android Studio
```

From Android Studio, run the app on an emulator or a connected device.

## Development

Common tasks:

| Command            | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `pnpm dev`         | Vite dev server for the web shell                    |
| `pnpm test`        | App unit tests (Vitest)                              |
| `pnpm test:muya`   | Vendored editor-core (Muya) gate                     |
| `pnpm test:e2e`    | Mobile WebView journeys (Playwright)                 |
| `pnpm lint`        | ESLint                                               |
| `pnpm typecheck`   | `vue-tsc` type checking                              |
| `pnpm build`       | Type-check and produce the production web build      |
| `pnpm android:sync`| Build the web app and copy it into the Android project |

Architecture, at a glance:

```
Vue screens and feature UI
  -> feature workflows (editor, documents, home, settings)
  -> shared typed web adapters and document models
  -> Capacitor bridge -> focused native helpers + Android platform APIs
```

The Markdown editor core lives in `third_party/muya` as a vendored **and modified**
copy of `@muyajs/core` (Muya): it carries this project's Android and large-document
changes on top of upstream, alongside ported upstream fixes. Edits under
`third_party/muya/src/**` must be synced into `node_modules/@muyajs/core/src/**`
before local build/verification; a contract test detects drift.

The app writes categorized, timestamped runtime logs to the WebView console, to
Android logcat under the tag `MarkTextAndroid`, and to a rotating file in the
app's private storage. Document text is never logged — editor logs use metadata
only (character/word/line counts, event names, error details).

### Continuous integration

- **Web quality** — ESLint, TypeScript type-check, and the Vite production build.
- **Android debug** — Capacitor sync and a Gradle `assembleDebug`, uploading the
  resulting debug APK as a short-lived artifact.
- **Dependency review** — reviews `package.json`/lockfile changes on pull
  requests.

## Tech stack

- [Vue 3](https://vuejs.org/) + [Vite](https://vite.dev/) for the web shell.
- [Capacitor](https://capacitorjs.com/) for the Android project and native bridge.
- A modified [`@muyajs/core`](https://github.com/marktext/muya) (Muya) as the
  Markdown editor core.

## Contributing

Issues and pull requests are welcome. Please keep each change focused and
coherent, include tests where it makes sense, and make sure `pnpm test`,
`pnpm lint`, and `pnpm typecheck` pass before opening a PR.

## License & attribution

MarkText for Android is released under the [MIT License](LICENSE).

This is an **unofficial** Android port. It builds on MarkText's open-source work
and is not affiliated with or endorsed by the MarkText project:

- **MarkText** — the desktop editor and design lineage this port follows.
  Copyright © Luo Ran and MarkText contributors. MIT licensed.
- **Muya** (`@muyajs/core`) — the Markdown editor core this project's editor is
  derived from and modifies, vendored under `third_party/muya` with its original
  MIT license retained
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## Acknowledgements

- [MarkText](https://github.com/marktext/marktext) and its
  [contributors](https://github.com/marktext/marktext/graphs/contributors) for
  the editor and the design it inherits.
- [Muya](https://github.com/marktext/muya) for the Markdown editing engine.
- [Vue](https://vuejs.org/), [Vite](https://vite.dev/), and
  [Capacitor](https://capacitorjs.com/) for the app foundation.
