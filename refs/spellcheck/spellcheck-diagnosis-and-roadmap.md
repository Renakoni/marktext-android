# Spellcheck Diagnosis And Roadmap

Date: 2026-07-08

Branch used for investigation: `diagnose-spellcheck-webview`

Status: documented and deferred. This is not an active product PR plan. The feature is useful and extensible, but it is not urgent enough to displace the current main work.

## Summary

Spellcheck can be built for MarkText Android.

The important distinction is that the current app does not have a MarkText-owned spellcheck engine. The current setting only controls browser/WebView native spellcheck attributes:

- `spellcheckerEnabled` maps to Muya `spellcheckEnabled`.
- `spellcheckerLanguage` maps to editor `lang`.
- `spellcheckerUnderline` controls whether native marks are hidden.
- There is no app-owned tokenizer, typo checker, suggestion engine, custom dictionary, or Add word backend.

The investigation disproved the broad hypothesis that Android WebView spellcheck is globally unavailable. On the tested emulator, native WebView spellcheck works for normal controls and can also mark Muya editor text when the runtime state is correct.

The product conclusion is:

- WebView native spellcheck can remain a best-effort visual aid.
- It should not be the foundation for product-grade Add word/custom dictionary behavior.
- If we want Word-like behavior, build a MarkText-owned spellcheck backend and render our own marks/suggestions.

## Current App Behavior

The current setting is browser-backed, not a full spellchecker.

Code evidence:

- Default setting is off: `src/features/settings/editingSettings.ts:147`
- Default language is `en-US`: `src/features/settings/editingSettings.ts:148`
- Native underline display is enabled by default: `src/features/settings/editingSettings.ts:149`
- Settings map into Muya options through `getMuyaEditingOptions`: `src/features/settings/editingSettings.ts:429`
- `spellcheckerEnabled` maps to `spellcheckEnabled`: `src/features/settings/editingSettings.ts:454`
- `spellcheckerUnderline` maps to `spellcheckHideMarks`: `src/features/settings/editingSettings.ts:455`
- Language changes are pushed with `setSpellcheckLanguage`: `src/features/settings/editingSettings.ts:470`

Muya code evidence:

- Muya root toggles the browser `spellcheck` attribute: `third_party/muya/src/muya.ts:320`
- Muya root is created as `contenteditable=true`: `third_party/muya/src/muya.ts:1703`
- Muya root receives `spellcheck=true/false`: `third_party/muya/src/muya.ts:1706`
- Text content blocks render as `span`: `third_party/muya/src/block/base/content.ts:397`
- Text content blocks use class `mu-content`: `third_party/muya/src/block/base/content.ts:398`
- Text content blocks are themselves `contenteditable=true`: `third_party/muya/src/block/base/content.ts:400`

Settings UI evidence:

- Spellcheck toggle row exists: `src/features/settings/settingsContent.ts:866`
- Spellcheck language row exists: `src/features/settings/settingsContent.ts:874`
- Underline row exists: `src/features/settings/settingsContent.ts:889`
- Dictionary section exists but is unfinished: `src/features/settings/settingsContent.ts:898`
- Dictionary rows are explicitly TODO: `src/features/settings/settingsContent.ts:899`
- Add word row exists as UI descriptor only: `src/features/settings/settingsContent.ts:911`
- Remove word row exists as UI descriptor only: `src/features/settings/settingsContent.ts:919`

Implication:

The current app can toggle the native WebView/browser spelling surface, but it cannot honestly claim to own spellcheck suggestions or dictionary behavior.

## WebView Version Pinning

Ordinary Android apps cannot pin Android System WebView or Chrome WebView provider version inside the APK.

The app can inspect the active provider with `WebView.getCurrentWebViewPackage()`. The actual provider and version are controlled by the Android system, WebView package installation, OEM image, updates, and developer options.

Investigation evidence from emulator:

```text
Current WebView package: com.google.android.webview 124.0.6367.219
System spellchecker: com.google.android.inputmethod.latin/com.android.inputmethod.latin.spellcheck.AndroidSpellCheckerService
```

Product choices:

- Keep Android WebView and accept provider variability.
- Ship a different embedded engine such as GeckoView, which is a major product and size tradeoff.
- Avoid native WebView spellcheck as the product backend and build a MarkText-owned spellcheck layer.

Recommended decision:

Use WebView native spellcheck only as optional/best-effort behavior. Do not depend on it for custom dictionary or Add word.

## Runtime Findings

### Native Controls

Diagnostic branch added a Spellcheck probe panel under Advanced diagnostics.

The probe included:

- `<textarea spellcheck="true" lang="en-US">`
- `<div contenteditable spellcheck="true" lang="en-US">`

Evidence screenshots:

- `logs/spellcheck-probe-textarea-typed.png`
- `logs/spellcheck-probe-contenteditable-typed.png`

Result:

Both native controls showed WebView red spelling marks after focus/input.

Conclusion:

Android WebView native spellcheck is not globally broken on the tested provider/device.

### Muya Editor

Runtime state confirmed through Chrome DevTools Protocol:

```json
{
  "localSettings": {
    "spellcheckerEnabled": true,
    "spellcheckerLanguage": "en-US",
    "spellcheckerUnderline": true
  },
  "root": {
    "contenteditable": "true",
    "spellcheckAttr": "true",
    "spellcheckProp": true,
    "lang": "en-US"
  },
  "counts": {
    "spellcheck": 1,
    "spellcheckFalse": 0,
    "hideMarks": 0,
    "muContent": 2
  }
}
```

Evidence screenshots:

- `logs/spellcheck-muya-root-false.png`
- `logs/spellcheck-muya-root-true-clean.png`
- `logs/spellcheck-after-open-draft.png`

Result:

Muya text can show Android WebView native spelling marks when spellcheck is enabled and WebView has a chance to check the text after focus/input.

Important nuance:

Earlier screenshots suggested Muya did not show marks, but later controlled runs showed marks in the same editor. The issue is state-sensitive, not a total Muya/WebView incompatibility.

Likely contributors:

- whether the setting is actually enabled;
- whether `spellcheckerUnderline` is hiding marks;
- whether WebView has received focus/input after the text changed;
- WebView provider timing and native spellcheck scheduling;
- Muya's editable DOM structure and selection/input handling.

### DOM Shape Probe

Temporary probe shapes were injected into the editor page:

- `shape-a`: block `div contenteditable`
- `shape-b`: `span contenteditable`
- `shape-c`: root `div contenteditable`, child `span contenteditable`
- `shape-d`: root `div contenteditable`, child `span`

Evidence screenshots:

- `logs/spellcheck-dom-shape-probe-initial.png`
- `logs/spellcheck-shape-a-after-input.png`
- `logs/spellcheck-shape-b-after-input.png`
- `logs/spellcheck-shape-d-after-input.png`

Observed result:

The simple `span contenteditable` shape displayed native red marks reliably. Other shapes were less consistent during the probe.

Interpretation:

Android WebView native spellcheck is sensitive to editable DOM shape and focus/input timing. That sensitivity is enough reason not to build custom dictionary UX on top of native WebView spellcheck alone.

## Open Source Engine Options

Reference projects were cloned under ignored `refs/spellcheck/` for local evaluation.

### nspell

Path: `refs/spellcheck/nspell`

Fit: best first candidate.

Pros:

- MIT license.
- Hunspell-compatible JavaScript checker.
- Deterministic across OS/WebView because dictionaries are explicit app assets.
- Supports `correct`, `suggest`, `add`, `remove`, and personal dictionaries.

Cons:

- No tokenizer.
- MarkText must own Markdown-aware tokenization.
- MarkText must map text offsets back to Muya DOM ranges for underlines and suggestions.
- Needs dictionary assets such as English `.aff`/`.dic` files.

### Typo.js

Path: `refs/spellcheck/Typo.js`

Fit: useful reference, not first choice.

Pros:

- Browser-oriented.
- Supports `check` and `suggest`.
- Modified BSD license.

Cons:

- Older project structure.
- Less aligned with current Vite/Capacitor packaging.
- Less attractive than `nspell` unless future testing shows better Android performance.

### hunspell-wasm

Path: `refs/spellcheck/hunspell-wasm`

Fit: second-phase option if `nspell` quality is insufficient.

Pros:

- Real Hunspell through WebAssembly.
- Strong spelling/suggestion behavior.
- Supports add/remove words.

Cons:

- Heavier packaging.
- `.wasm` loading adds Capacitor/WebView complexity.
- License and distribution need more careful review.

## Recommended Future Architecture

If this feature becomes a priority, split it into staged PRs.

### Stage 1: Make Current UI Honest

Goal:

Clarify that current spellcheck is browser/system-backed.

Possible changes:

- Rename or describe the setting as system/browser spellcheck.
- Keep language and underline settings if they remain useful.
- Hide or disable Add word/remove word/custom dictionary rows until a real backend exists.

Acceptance:

- No UI implies that MarkText owns custom dictionary behavior.
- Existing native red marks still work where WebView paints them.

### Stage 2: App-Owned Checker Prototype

Goal:

Use `nspell` to check English text deterministically in app code.

Scope:

- Load English dictionary assets.
- Check plain text in one editor block.
- Add a small internal API around `check`, `suggest`, `add`, and `remove`.
- Keep native WebView spellcheck disabled or visually separated during the prototype to avoid duplicate marks.

Acceptance:

- Given known misspellings, checker returns stable results independent of WebView provider.
- Adding a word changes checker result immediately.
- No document text is logged by default.

### Stage 3: Markdown-Aware Tokenization

Goal:

Avoid flagging Markdown syntax as misspelled words.

Scope:

- Tokenize prose ranges.
- Skip code spans, fenced code blocks, inline math, links/URLs, image syntax, HTML tags, frontmatter, and likely identifiers.
- Preserve offsets back to block text.

Acceptance:

- Common Markdown syntax is not marked as spelling error.
- Real prose misspellings are still detected.

### Stage 4: Muya Range Mapping And Rendering

Goal:

Render MarkText-owned spelling marks in the editor.

Scope:

- Map checker offsets to Muya block DOM ranges.
- Render lightweight underlines without disturbing selection, IME, or Markdown editing.
- Recheck only changed/visible blocks.

Acceptance:

- Marks survive normal typing and scrolling.
- Selection handles, custom mobile selection toolbar, IME composition, paste, cut, delete, and undo remain correct.
- Performance is acceptable on long documents.

### Stage 5: Suggestions And Add Word

Goal:

Integrate spellcheck with the mobile selection toolbar/custom action sheet.

Scope:

- Detect selected/current word.
- Show suggestions.
- Add word to personal dictionary.
- Remove word from personal dictionary.
- Persist custom words in app storage.

Acceptance:

- Add word immediately removes the mark for that word.
- Suggestions replace only the intended word/range.
- Custom words survive app restart.
- UI follows current mobile toolbar/theme direction.

## Deferred Decision

This feature should be deferred for now.

Reason:

- Native WebView red marks are available as a best-effort aid.
- The full product-grade version is a real subsystem, not a small settings cleanup.
- Building it properly touches tokenizer design, Muya range mapping, rendering, persistence, toolbar integration, and privacy-sensitive logging.
- Current product value is lower than the main editor/mobile interaction work already in progress.

Recommended next action when resumed:

Start with Stage 1 if the settings UI feels misleading. Start with Stage 2 only when we are ready to invest in a real MarkText-owned spellcheck backend.

## Verification Already Run

During the diagnostic branch:

```powershell
pnpm typecheck
pnpm build
pnpm exec cap sync android
.\gradlew.bat assembleDebug
```

Additional diagnostic checks:

```powershell
adb -s emulator-5554 shell dumpsys webviewupdate
adb -s emulator-5554 shell settings get secure selected_spell_checker
adb -s emulator-5554 shell settings get secure selected_spell_checker_subtype
```

Latest documentation-only update:

```powershell
pnpm typecheck
```

Result:

- Typecheck passed.
- Diagnostic evidence was captured through adb screenshots and Chrome DevTools Protocol.
- No product implementation PR was created from this branch.
