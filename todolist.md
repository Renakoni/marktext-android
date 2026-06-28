# TODO

## Phase 0 - Repository Setup

- [ ] Create GitHub repository as `marktext-android`.
- [ ] Initialize local Git history.
- [ ] Confirm whether the public app name should stay `MarkText for Android` or use a non-official name until maintainers approve branding.
- [ ] Add MIT/license attribution plan for reused MarkText/Muya code and assets.

## Phase 1 - Android Baseline

- [ ] Open the generated Android project with `pnpm android:open`.
- [ ] Run the app on an Android emulator.
- [x] Run the app on a MuMu Android emulator.
- [x] Confirm initial editor rendering in Android WebView.
- [ ] Run the app on a physical Android device.
- [ ] Confirm soft keyboard behavior does not cover the active editing line.
- [ ] Confirm toolbar/status bar safe-area behavior on small screens.

## Phase 2 - File Access

- [ ] Decide the Android file model: Storage Access Framework document picker first, broad file manager behavior later.
- [ ] Add open `.md` file flow.
- [ ] Add save current document flow.
- [ ] Add save-as flow.
- [ ] Track current file URI and dirty state.
- [ ] Preserve line endings where possible, or document normalization behavior if preservation is not practical.
- [ ] Add user-facing error states for denied permission, missing file, and write failure.

## Phase 3 - Editor Integration

- [ ] Audit Muya behavior on mobile selection, copy/paste, IME input, and long documents.
- [ ] Verify ordered lists, task lists, links, images, tables, code blocks, math, and diagrams.
- [ ] Decide which Muya plugins are enabled by default on mobile.
- [ ] Add mobile-friendly commands for undo, redo, heading, list, link, image, and code block.
- [ ] Add autosave for local drafts without overwriting explicit files unexpectedly.

## Phase 4 - Images And Attachments

- [ ] Define image handling for local Android files and content URIs.
- [ ] Add insert image from picker.
- [ ] Confirm relative image paths for files opened from shared folders or document providers.
- [ ] Add copy/import image behavior if direct relative file access is blocked by Android permissions.

## Phase 5 - Packaging

- [ ] Set app icon and splash screen.
- [ ] Confirm Android package id and display name.
- [ ] Add release signing documentation.
- [ ] Produce a debug APK.
- [ ] Produce a release APK/AAB.
- [ ] Document install and testing steps.

## Phase 6 - Quality Gates

- [ ] Keep `pnpm build` passing.
- [ ] Keep `pnpm android:sync` passing.
- [ ] Add focused unit tests for pure helper logic once file/document helpers exist.
- [ ] Add Playwright coverage for the web shell if UI state grows.
- [ ] Add Android smoke test notes for emulator and physical device.

## Later

- [ ] Bundle-size optimization and code splitting.
- [ ] Dark mode.
- [ ] Settings screen.
- [ ] Recent files.
- [ ] Search and replace.
- [ ] Table of contents drawer.
- [ ] Share/open-with integration.
- [ ] Upstream MarkText discussion if official branding or closer project affiliation is desired.
