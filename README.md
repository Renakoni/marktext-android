<p align="center">
  <img src="docs/assets/logo.png" alt="MarkText for Android logo" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <b>English</b>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>Markdown, quietly yours.</em>
</p>

<p align="center">
  <sub>A lean Markdown editor for Android.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="License: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="Latest release"></a>
</p>

<p align="center">
  <a href="#highlights">Highlights</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="#license--attribution">License</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Editing a Markdown document — light theme" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="The same document in a dark theme" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; Light &nbsp;·&nbsp; Dark &nbsp;☾&nbsp; — whichever your system prefers</sub>
</p>

> [!NOTE]
> **Unofficial community port** — not affiliated with, endorsed by, or maintained
> by the MarkText team. It builds on and modifies MarkText's open-source editor
> core (Muya) for Android; see [License & attribution](#license--attribution).

## What it is

MarkText for Android brings MarkText's live-preview Markdown editing to the phone.
Its editor is Muya, MarkText's open-source core, heavily adapted for mobile:
faster on large documents, re-laid-out for a phone's width, and given touch
selection and toolbars. What you write renders with the same fidelity as on
desktop, in an interface built for one hand.

## Highlights

### A lightweight Markdown editor that never loses a word

<table width="100%">
<tr>
<td valign="middle">

- True live-preview (WYSIWYG) editing.
- Full CommonMark and GitHub Flavored Markdown: math (KaTeX), tables, footnotes,
  front matter, diagrams, and syntax-highlighted code.
- A document outline and in-editor search that stay smooth even in long files.
- Export to **PDF** with math, code highlighting, and fonts all baked in.
- **Never loses your work.** Autosave and recovery drafts keep every change, and
  atomic, all-or-nothing writes mean an interrupted save never leaves a
  half-written or corrupted file.
- **Private by default.** No account, no cloud, no telemetry; everything stays on
  the device.
- **Lightweight.** A focused Vue + Capacitor shell rather than a heavy native stack
  keeps the whole app around 7.8 MB — small and light, yet fully featured.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="Tables, code, and math rendered live while typing" width="200"></td>
</tr>
</table>

### Make it yours

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="The docked format toolbar and a customized selection (paste) bar shown while editing" width="200"></td>
<td valign="middle">

Make it what you want, right down to the bars you touch while writing:

- **Build your own toolbars.** Compose the bottom quick bar from a pool of commands
  and drag to reorder it. Even the selection toolbar can hold your own commands.
- **Themes and appearance.** Light, dark, and custom themes; adjustable type and
  layout.
- **Markdown to your taste.** Fine-tune how your Markdown is written and rendered,
  from list markers to front matter.
- **File-level control.** Per-document encoding, line endings, and trailing
  newline handling.

</td>
</tr>
</table>

### Built for the phone, polished for everyone

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="The editor showing a Chinese document with a Chinese interface" width="200"></td>
<td valign="middle">

- **Your files stay put.** Edit `.md` straight from any storage provider through
  the system picker, and pass documents to and from other apps with the share
  sheet.
- **Made for the thumb.** Comfortable one-handed reach and a calm, editor-first
  layout.
- **Accessible and restrained.** A quiet graphite design that meets WCAG 2.2 AA,
  with a clear focus order and calm, minimal motion.
- **Ten languages,** chosen automatically from your system: English, German,
  Spanish, French, Japanese, Korean, Portuguese, Turkish, and Simplified and
  Traditional Chinese.

</td>
</tr>
</table>

---

## Project status

> [!IMPORTANT]
> The first signed public release, **v0.1.0**, is available. Its APK is built by
> the repository's release workflow, pinned to the official release certificate,
> and has passed clean-install and same-key upgrade checks on Android 14.

Download signed builds from the
[Releases](https://github.com/Renakoni/marktext-android/releases/latest) page.

## Build from source

You'll need [Node.js](https://nodejs.org/) with [pnpm](https://pnpm.io/) and
[Android Studio](https://developer.android.com/studio) (the Android SDK and a
JDK; the app runs on API 24 and newer and is built against API 36).

```sh
pnpm install          # install dependencies
pnpm dev              # preview the web shell in a browser
pnpm android:sync     # build the web app and sync it into the Android project
pnpm android:open     # open it in Android Studio, then run on a device or emulator
```

Other scripts (`test`, `lint`, `typecheck`, `build`) are in `package.json`.
Release maintainers should follow [`docs/RELEASING.md`](docs/RELEASING.md).

> [!TIP]
> The Markdown editor core is a vendored, **modified** copy of `@muyajs/core` (Muya)
> under `third_party/muya`. If you change it, sync your edits into
> `node_modules/@muyajs/core/src/**` before building — a contract test catches drift.

## Contributing

Issues and pull requests are welcome. Keep each change focused, and add tests
where they make sense.

## License & attribution

MarkText for Android is released under the [MIT License](LICENSE).

It is an **unofficial** port, built on MarkText's open-source work and not
affiliated with or endorsed by the MarkText project:

- **MarkText** — the desktop editor and design this port follows. Copyright © Luo
  Ran and the MarkText contributors, MIT licensed.
- **Muya** (`@muyajs/core`) — the editor core, vendored and modified under
  `third_party/muya` with its original MIT license kept
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## Acknowledgements

MarkText for Android stands on a lot of open-source work: the
[MarkText](https://github.com/marktext/marktext) editor and its
[contributors](https://github.com/marktext/marktext/graphs/contributors), the
[Muya](https://github.com/marktext/muya) editing engine, and
[Vue](https://vuejs.org/), [Vite](https://vite.dev/), and
[Capacitor](https://capacitorjs.com/). Thank you to everyone who built them.

---

<p align="center"><sub><em>Markdown, quietly yours.</em></sub></p>
