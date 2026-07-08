# Spellcheck Diagnosis Branch

Branch: `diagnose-spellcheck-webview`

Purpose:

- Prove whether Android WebView native `spellcheck` is usable for MarkText Android.
- Separate WebView platform behavior from Muya DOM behavior.
- Compare app-owned spellcheck engine options before committing to dictionary / Add word UX.

Status:

- Local diagnostic branch only. Do not push as a product PR.
- The broad failure hypothesis is disproven: Android WebView native spellcheck is usable in this environment.
- The remaining product decision is whether to keep WebView native spelling marks as a best-effort visual aid or build a MarkText-owned spellcheck backend for stable dictionary/Add word behavior.

## Current Implementation Facts

Current MarkText Android spellcheck is browser-backed only:

- `spellcheckerEnabled` maps to Muya `spellcheckEnabled`.
- Muya sets `spellcheck="true"` / `spellcheck="false"` on the editor root.
- `spellcheckerLanguage` maps to the editor root `lang` attribute.
- `spellcheckerUnderline` only controls whether native spelling marks are hidden by CSS.

There is no MarkText-owned spellcheck backend today:

- no word tokenizer;
- no typo detection;
- no suggestions;
- no custom dictionary that affects typo detection;
- no MarkText-owned red underline rendering.

## WebView Version Pinning

Ordinary Android apps cannot pin an Android System WebView / Chrome WebView provider version inside the APK.

The app can inspect the active provider through `WebView.getCurrentWebViewPackage()`, which this branch exposes in Advanced diagnostics. The actual provider and version are controlled by the Android system / WebView provider installation / developer options / OEM image, not by our app dependency graph.

Emulator evidence:

```text
Current WebView package: com.google.android.webview 124.0.6367.219
System spellchecker: com.google.android.inputmethod.latin/com.android.inputmethod.latin.spellcheck.AndroidSpellCheckerService
```

If we need a fixed rendering engine, that is a different product decision:

- keep Android WebView and accept provider variability;
- ship a different embedded engine such as GeckoView, with major integration and size tradeoffs;
- avoid native WebView spellcheck entirely by building MarkText-owned spellcheck rendering.

## Diagnostic UI Added

Advanced > Diagnostics now has temporary rows:

- `WebView`: active WebView provider/version.
- `System spellchecker`: current Android `TextServicesManager` spell checker provider.
- `Spellcheck probe`: opens a branch-only diagnostic panel.

The probe panel contains:

- a native `<textarea spellcheck="true" lang="en-US">`;
- a native `<div contenteditable spellcheck="true" lang="en-US">`;
- JSON describing those controls;
- a Muya editor state request path through `marktext-spellcheck-probe-request`.

Interpretation:

- If the native textarea/contenteditable do not show red spelling marks for `dadaasda adad dadada adadadad pon pan`, the active WebView provider is not giving us a reliable native spellcheck surface.
- If native controls show marks but Muya does not, the issue is in Muya DOM structure, attributes, or CSS.
- If textarea works but contenteditable does not, WebView native spellcheck is not reliable for our rich editor surface.

## Open Source Engine Notes

Reference clones are in this directory and are intentionally not committed.

### nspell

Path: `refs/spellcheck/nspell`

Pros:

- MIT license.
- Hunspell-compatible JavaScript spell checker.
- Deterministic across OS/WebView because dictionaries are explicit inputs.
- Supports `correct`, `suggest`, `add`, `remove`, and personal dictionaries.

Cons:

- No tokenizer; MarkText must own tokenization and Markdown-range mapping.
- Needs dictionary packages such as `dictionary-en`.

Initial fit:

- Best first candidate for a MarkText-owned English spellcheck layer.

### Typo.js

Path: `refs/spellcheck/Typo.js`

Pros:

- Modified BSD license.
- Browser-oriented Hunspell-style checker.
- Supports `check` and `suggest`.

Cons:

- Older project shape.
- Dictionary loading style is less aligned with our Vite/Capacitor app.
- Less attractive than `nspell` unless tests show better Android performance.

Initial fit:

- Useful reference, not the first implementation choice.

### hunspell-wasm

Path: `refs/spellcheck/hunspell-wasm`

Pros:

- Real Hunspell WebAssembly port.
- Supports spelling, suggestions, add/remove words, additional dictionaries.
- Includes TypeScript wrapper.

Cons:

- License is LGPL/GPL/MPL tri-license because Hunspell is LGPL/GPL/MPL.
- Bundles `.wasm`; current sample wasm is about 812 KB before app packaging effects.
- More complex asset loading in Capacitor/WebView.

Initial fit:

- Powerful but heavier. Keep as second-phase option if `nspell` quality is not enough.

## Runtime Evidence

### Native WebView Controls

Evidence:

- `logs/spellcheck-probe-textarea-typed.png`
- `logs/spellcheck-probe-contenteditable-typed.png`

Result:

- `<textarea spellcheck="true" lang="en-US">` shows native red spelling marks.
- Simple `<div contenteditable spellcheck="true" lang="en-US">` shows native red spelling marks.

Conclusion:

- Android WebView spellcheck is not globally broken on this provider/device.
- A missing underline in the editor must be investigated as editor DOM/state behavior, not as a blanket WebView limitation.

### Muya Editor

Current confirmed runtime state:

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

Evidence:

- `logs/spellcheck-muya-root-false.png`
- `logs/spellcheck-muya-root-true-clean.png`
- `logs/spellcheck-after-open-draft.png`

Result:

- Muya text can show Android WebView native spelling marks when spellcheck is enabled.
- A direct DOM experiment where the outer `.muya-host` was changed to `contenteditable="false"` and `.mu-content` remained editable also showed spelling marks.
- A later clean root-editable run also showed spelling marks, so the outer root `contenteditable` is not the sole cause.

Conclusion:

- The root problem is not "Muya can never show Android WebView spellcheck marks."
- The current native spellcheck path is state-sensitive:
  - WebView native spellcheck can mark Muya text.
  - The editor must have `spellcheck=true`, a supported language, no hide-marks class, and a text node that WebView has had a chance to check after focus/input.
  - Normal browser-native marks remain provider-controlled and are not a stable product backend for Add word/custom dictionary.

### DOM Shape Probe

Temporary probe shapes:

- `shape-a`: block `div contenteditable`
- `shape-b`: `span contenteditable`
- `shape-c`: root `div contenteditable`, child `span contenteditable`
- `shape-d`: root `div contenteditable`, child `span`

Evidence:

- `logs/spellcheck-dom-shape-probe-initial.png`
- `logs/spellcheck-shape-a-after-input.png`
- `logs/spellcheck-shape-b-after-input.png`
- `logs/spellcheck-shape-d-after-input.png`

Observed result:

- A simple `span contenteditable` displayed native red marks reliably.
- Other shapes were less consistent during the probe.

Interpretation:

- Android WebView spellcheck is sensitive to editable DOM shape and focus/input timing.
- This is enough to avoid treating native spellcheck as a fully deterministic product layer.
- It is not enough to justify a large Muya editing-model rewrite solely for native spellcheck.

## Product Decision

The current setting is browser-backed spellcheck, not a full MarkText spellchecker.

It can honestly support:

- toggling the browser/WebView spellcheck attribute;
- selecting the intended language;
- hiding/showing native spelling marks where the provider paints them.

It cannot honestly support yet:

- deterministic typo detection across devices;
- MarkText-owned suggestions;
- MarkText-owned Add word;
- MarkText-owned remove word;
- custom dictionary behavior that affects all spelling decisions.

Decision:

- Keep native WebView spellcheck as a best-effort visual aid if we want the low-cost setting.
- Do not build Add word / dictionary UX on top of WebView native spellcheck alone.
- For a product-grade spellcheck feature, build MarkText-owned spellcheck using a JS/Hunspell-compatible engine and render our own marks/suggestions.

Recommended implementation path:

1. Rename or describe the current toggle as browser/system spellcheck if it remains native-only.
2. Hide or mark dictionary/Add word rows unfinished until an app-owned backend exists.
3. Prototype app-owned English spellcheck with `nspell` first.
4. Add Markdown-aware tokenization and DOM range mapping around Muya instead of replacing Muya's selection system.
5. Add custom dictionary storage only after tokenizer/range mapping is stable.

Completion criteria for a future product spellcheck PR:

- deterministic checker in app code;
- English dictionary loaded from app assets;
- incremental check of visible/changed blocks;
- custom words persisted in MarkText settings/storage;
- Add word affects subsequent checks immediately;
- no selected document text is written to logs by default;
- native WebView spellcheck remains optional or disabled to avoid duplicate red marks.

## Verification Run

Completed:

```powershell
pnpm typecheck
pnpm build
pnpm exec cap sync android
.\gradlew.bat assembleDebug
```

Result:

- Frontend typecheck/build passed.
- Android debug build passed.
- APK installed and launched on `emulator-5554`.
- No startup fatal/error logs were observed in the sampled logcat output.

Additional diagnostic verification:

- `adb shell dumpsys webviewupdate` confirmed the active WebView provider.
- `adb shell settings get secure selected_spell_checker` confirmed a system spellchecker provider.
- Chrome DevTools Protocol confirmed Muya runtime spellcheck attributes and local settings.
- `adb exec-out screencap` captured native-control, DOM-shape, and Muya-editor evidence listed above.
